import type { PlayerEvent } from "@/datamodel";
import {
  eventGroupSchema,
  eventTypeSchema,
  matchHalfSchema,
  playerEventSchema,
  shotAimSchema,
  shotDirectionSchema,
  shotPosition,
} from "@/datamodel";
import {
  ARCAZZI_GAME_V1,
  ARCAZZI_GAME_V1_HEADERS,
  type ArcazziGameV1Header,
  IMPORT_MAX_DATA_ROWS,
  IMPORT_MAX_EVENTS,
  IMPORT_MAX_PLAYERS,
  IMPORT_MAX_TEXT_CODE_POINTS,
  IMPORT_MIN_PLAYERS,
  LEGACY_EVENT_LOG_V0,
  LEGACY_EVENT_LOG_V0_HEADERS,
  legacyDateToTimestamp,
} from "./csvContract";
import { DiagnosticCollector } from "./diagnostics";
import { parseCsvText, type RawCsvRow } from "./parseCsv";
import type {
  CanonicalGameImport,
  CanonicalImportEvent,
  CanonicalRosterPlayer,
  ImportValidationResult,
} from "./types";

export type DetectedFormat =
  | typeof ARCAZZI_GAME_V1
  | typeof LEGACY_EVENT_LOG_V0;

export type CsvInspection =
  | { ok: false; diagnostics: DiagnosticCollector["diagnostics"] }
  | { ok: true; format: DetectedFormat; header: RawCsvRow; dataRows: RawCsvRow[] };

function headersMatch(cells: string[], expected: readonly string[]): boolean {
  return (
    cells.length === expected.length &&
    expected.every((header, index) => cells[index] === header)
  );
}

/**
 * Transport-agnostic structural inspection: UTF-8/NUL handling is expected
 * to be done by the caller on bytes; this validates CSV structure, header
 * set, format detection and the global row limit.
 */
export function inspectCsv(text: string): CsvInspection {
  const collector = new DiagnosticCollector();

  if (text.includes("\u0000")) {
    collector.add({
      code: "INVALID_BYTES",
      message: "The file contains NUL bytes and is not a valid CSV text file.",
    });
    return { ok: false, diagnostics: collector.diagnostics };
  }

  const parsed = parseCsvText(text);

  if (!parsed.ok) {
    collector.add({
      code: "CSV_PARSE_ERROR",
      row: parsed.line,
      message: parsed.message,
    });
    return { ok: false, diagnostics: collector.diagnostics };
  }

  const [header, ...dataRows] = parsed.rows;

  if (!header) {
    collector.add({
      code: "EMPTY_FILE",
      message: "The file has no header row. Download the template and start from it.",
    });
    return { ok: false, diagnostics: collector.diagnostics };
  }

  const seen = new Set<string>();
  for (const cell of header.cells) {
    if (seen.has(cell)) {
      collector.add({
        code: "DUPLICATE_HEADER",
        row: header.line,
        column: cell,
        value: cell,
        message: `The header "${cell}" appears more than once.`,
      });
      return { ok: false, diagnostics: collector.diagnostics };
    }
    seen.add(cell);
  }

  let format: DetectedFormat;
  if (headersMatch(header.cells, ARCAZZI_GAME_V1_HEADERS)) {
    format = ARCAZZI_GAME_V1;
  } else if (headersMatch(header.cells, LEGACY_EVENT_LOG_V0_HEADERS)) {
    format = LEGACY_EVENT_LOG_V0;
  } else {
    collector.add({
      code: "UNSUPPORTED_FORMAT",
      row: header.line,
      value: header.cells.join(","),
      message:
        "The header row does not match a supported format (arcazzi-game-v1 or the legacy Arcazzi event export). See the import documentation.",
    });
    return { ok: false, diagnostics: collector.diagnostics };
  }

  if (dataRows.length > IMPORT_MAX_DATA_ROWS) {
    collector.add({
      code: "TOO_MANY_ROWS",
      value: String(dataRows.length),
      message: `The file has ${dataRows.length} data rows; the maximum is ${IMPORT_MAX_DATA_ROWS}.`,
    });
    return { ok: false, diagnostics: collector.diagnostics };
  }

  if (dataRows.length === 0) {
    collector.add({
      code: "NO_DATA_ROWS",
      message: "The file contains a header but no data rows.",
    });
    return { ok: false, diagnostics: collector.diagnostics };
  }

  return { ok: true, format, header, dataRows };
}

const STRICT_INT = /^-?\d+$/;
const ISO_WITH_OFFSET =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/;

function parseStrictInt(raw: string): number | null {
  if (!STRICT_INT.test(raw)) {
    return null;
  }
  const value = Number(raw);
  if (!Number.isSafeInteger(value)) {
    return null;
  }
  return value;
}

function parseStrictBool(raw: string): boolean | null {
  if (raw === "true") return true;
  if (raw === "false") return false;
  return null;
}

function codePointLength(text: string): number {
  return [...text].length;
}

type V1Row = {
  line: number;
  get: (column: ArcazziGameV1Header) => string;
};

function makeV1Row(row: RawCsvRow): V1Row {
  return {
    line: row.line,
    get: (column) => row.cells[ARCAZZI_GAME_V1_HEADERS.indexOf(column)] ?? "",
  };
}

const ZOD_PATH_TO_V1_COLUMN: Record<string, ArcazziGameV1Header> = {
  player: "player_number",
  half: "half",
  ellapsed_seconds: "elapsed_seconds",
  eventType: "event_type",
  eventGroup: "event_group",
  "event.goal": "shot_goal",
  "event.direction": "shot_direction",
  "event.aim": "shot_aim",
  "event.position": "shot_position",
  "event.playerIn": "substitution_player_in",
};

function reportPlayerEventZodIssues(
  collector: DiagnosticCollector,
  line: number,
  issues: { path: PropertyKey[]; message: string }[],
  columnFor: (path: string) => string | null,
): void {
  for (const issue of issues) {
    const path = issue.path.map(String).join(".");
    collector.add({
      code: "INVALID_EVENT",
      row: line,
      column: columnFor(path),
      message: issue.message,
    });
  }
}

type CandidateEvent = {
  line: number;
  sequence: number;
  event: PlayerEvent;
};

function crossRowChecks(
  collector: DiagnosticCollector,
  roster: CanonicalRosterPlayer[],
  events: CandidateEvent[],
  playerColumn: string,
  substitutionColumn: string,
): void {
  const rosterNumbers = new Set(roster.map((player) => player.number));

  for (const { line, event } of events) {
    if (!rosterNumbers.has(event.player)) {
      collector.add({
        code: "PLAYER_NOT_IN_ROSTER",
        row: line,
        column: playerColumn,
        value: String(event.player),
        message: `Player ${event.player} is not in the roster for this game.`,
      });
    }

    if (event.eventType === "substitution") {
      if (!rosterNumbers.has(event.event.playerIn)) {
        collector.add({
          code: "PLAYER_NOT_IN_ROSTER",
          row: line,
          column: substitutionColumn,
          value: String(event.event.playerIn),
          message: `Substitution target ${event.event.playerIn} is not in the roster for this game.`,
        });
      }
      if (event.event.playerIn === event.player) {
        collector.add({
          code: "SUBSTITUTION_SAME_PLAYER",
          row: line,
          column: substitutionColumn,
          value: String(event.event.playerIn),
          message: "A substitution must involve two different players.",
        });
      }
    }
  }

  // Ordering invariants over sequence order.
  const ordered = [...events].sort((a, b) => a.sequence - b.sequence);
  let maxFirstHalfSequence = Number.NEGATIVE_INFINITY;
  let minSecondHalfSequence = Number.POSITIVE_INFINITY;
  const lastElapsedByHalf = new Map<string, number>();

  for (const { line, sequence, event } of ordered) {
    if (event.half === "firstHalf") {
      maxFirstHalfSequence = Math.max(maxFirstHalfSequence, sequence);
    } else {
      minSecondHalfSequence = Math.min(minSecondHalfSequence, sequence);
    }

    const previous = lastElapsedByHalf.get(event.half);
    if (previous !== undefined && event.ellapsed_seconds < previous) {
      collector.add({
        code: "ELAPSED_DECREASED",
        row: line,
        column: "elapsed_seconds",
        value: String(event.ellapsed_seconds),
        message: `Elapsed seconds decreased within the ${event.half} (previous value ${previous}).`,
      });
    }
    lastElapsedByHalf.set(event.half, event.ellapsed_seconds);
  }

  if (maxFirstHalfSequence > minSecondHalfSequence) {
    collector.add({
      code: "HALF_ORDER_VIOLATION",
      column: "event_sequence",
      message:
        "All first-half events must have lower sequences than second-half events.",
    });
  }

  // Lineup consistency.
  let replaySkippedWarned = false;
  for (const half of ["firstHalf", "secondHalf"] as const) {
    const halfEvents = ordered.filter(({ event }) => event.half === half);
    const starters = halfEvents.filter(
      ({ event }) => event.eventType === "startingPlayer",
    );
    const starterNumbers = new Set<number>();

    for (const { line, event } of starters) {
      if (event.ellapsed_seconds !== 0) {
        collector.add({
          code: "STARTING_PLAYER_NOT_AT_ZERO",
          row: line,
          column: "elapsed_seconds",
          value: String(event.ellapsed_seconds),
          message: "Starting-player rows must have elapsed seconds of 0.",
        });
      }
      if (starterNumbers.has(event.player)) {
        collector.add({
          code: "DUPLICATE_STARTING_PLAYER",
          row: line,
          column: playerColumn,
          value: String(event.player),
          message: `Player ${event.player} is listed as a starting player more than once in the ${half}.`,
        });
      }
      starterNumbers.add(event.player);
    }

    if (starterNumbers.size > 7) {
      collector.add({
        code: "TOO_MANY_STARTING_PLAYERS",
        column: playerColumn,
        value: String(starterNumbers.size),
        message: `The ${half} has ${starterNumbers.size} starting players; the maximum is 7.`,
      });
      continue;
    }

    if (starters.length > 0 && starterNumbers.size === 7) {
      const onCourt = new Set(starterNumbers);
      for (const { line, event } of halfEvents) {
        if (event.eventType !== "substitution") {
          continue;
        }
        if (!onCourt.has(event.player)) {
          collector.add({
            code: "SUBSTITUTION_PLAYER_OFF_COURT",
            row: line,
            column: playerColumn,
            value: String(event.player),
            message: `Player ${event.player} is substituted out but is not on court.`,
          });
          break;
        }
        if (onCourt.has(event.event.playerIn)) {
          collector.add({
            code: "SUBSTITUTION_PLAYER_ALREADY_ON_COURT",
            row: line,
            column: substitutionColumn,
            value: String(event.event.playerIn),
            message: `Player ${event.event.playerIn} is substituted in but is already on court.`,
          });
          break;
        }
        onCourt.delete(event.player);
        onCourt.add(event.event.playerIn);
      }
    } else if (starters.length > 0 && !replaySkippedWarned) {
      replaySkippedWarned = true;
      collector.add({
        code: "LINEUP_REPLAY_SKIPPED",
        severity: "warning",
        message:
          "The starting lineup is incomplete, so court-state replay of substitutions was skipped.",
      });
    }
  }
}

function countGoals(events: CandidateEvent[]): number {
  return events.filter(
    ({ event }) => event.eventType === "shot" && event.event.goal,
  ).length;
}

function finishResult(
  collector: DiagnosticCollector,
  canonical: () => CanonicalGameImport,
): ImportValidationResult {
  if (collector.hasErrors) {
    return { ok: false, diagnostics: collector.diagnostics };
  }
  return { ok: true, canonical: canonical(), warnings: collector.warnings };
}

/** Validates an `arcazzi-game-v1` file into the canonical import model. */
export function validateArcazziGameV1(
  dataRows: RawCsvRow[],
): ImportValidationResult {
  const collector = new DiagnosticCollector();

  const matchRows: V1Row[] = [];
  const playerRows: V1Row[] = [];
  const eventRows: V1Row[] = [];

  for (const rawRow of dataRows) {
    if (rawRow.cells.length !== ARCAZZI_GAME_V1_HEADERS.length) {
      collector.add({
        code: "WRONG_FIELD_COUNT",
        row: rawRow.line,
        value: String(rawRow.cells.length),
        message: `Row has ${rawRow.cells.length} fields; expected ${ARCAZZI_GAME_V1_HEADERS.length}.`,
      });
      continue;
    }

    const row = makeV1Row(rawRow);

    if (row.get("format_version") !== ARCAZZI_GAME_V1) {
      collector.add({
        code: "UNSUPPORTED_VERSION",
        row: row.line,
        column: "format_version",
        value: row.get("format_version"),
        message: `Every row must have format_version "${ARCAZZI_GAME_V1}".`,
      });
      continue;
    }

    const recordType = row.get("record_type");
    if (recordType === "match") {
      matchRows.push(row);
    } else if (recordType === "player") {
      playerRows.push(row);
    } else if (recordType === "event") {
      eventRows.push(row);
    } else {
      collector.add({
        code: "UNKNOWN_RECORD_TYPE",
        row: row.line,
        column: "record_type",
        value: recordType,
        message: 'record_type must be "match", "player", or "event".',
      });
    }
  }

  // Match row.
  if (matchRows.length !== 1) {
    collector.add({
      code: "MATCH_ROW_COUNT",
      row: matchRows[1]?.line ?? null,
      column: "record_type",
      value: String(matchRows.length),
      message: `The file must contain exactly one "match" row; found ${matchRows.length}.`,
    });
    return { ok: false, diagnostics: collector.diagnostics };
  }

  const matchRow = matchRows[0];
  const requireText = (
    row: V1Row,
    column: ArcazziGameV1Header,
    label: string,
  ): string | null => {
    const value = row.get(column);
    if (value === "") {
      collector.add({
        code: "REQUIRED_CELL_BLANK",
        row: row.line,
        column,
        message: `${label} is required.`,
      });
      return null;
    }
    if (codePointLength(value) > IMPORT_MAX_TEXT_CODE_POINTS) {
      collector.add({
        code: "TEXT_TOO_LONG",
        row: row.line,
        column,
        value,
        message: `${label} exceeds ${IMPORT_MAX_TEXT_CODE_POINTS} characters.`,
      });
      return null;
    }
    return value;
  };
  const requireBlank = (
    row: V1Row,
    columns: ArcazziGameV1Header[],
    context: string,
  ) => {
    for (const column of columns) {
      if (row.get(column) !== "") {
        collector.add({
          code: "FORBIDDEN_CELL_POPULATED",
          row: row.line,
          column,
          value: row.get(column),
          message: `${column} must be empty on a ${context} row.`,
        });
      }
    }
  };

  const matchExternalId = requireText(
    matchRow,
    "match_external_id",
    "match_external_id",
  );

  const rawStartedAt = matchRow.get("match_started_at");
  let matchStartedAt: string | null = null;
  if (!ISO_WITH_OFFSET.test(rawStartedAt)) {
    collector.add({
      code: "INVALID_TIMESTAMP",
      row: matchRow.line,
      column: "match_started_at",
      value: rawStartedAt,
      message:
        "match_started_at must be an ISO 8601 timestamp with a UTC offset or Z (for example 2026-03-01T18:30:00Z).",
    });
  } else {
    const time = Date.parse(rawStartedAt);
    if (Number.isNaN(time)) {
      collector.add({
        code: "INVALID_TIMESTAMP",
        row: matchRow.line,
        column: "match_started_at",
        value: rawStartedAt,
        message: "match_started_at is not a valid date/time.",
      });
    } else {
      matchStartedAt = new Date(time).toISOString();
    }
  }

  const trackedTeamName = requireText(matchRow, "tracked_team", "tracked_team");
  let opponentName: string | null = matchRow.get("opponent") || null;
  if (
    opponentName !== null &&
    codePointLength(opponentName) > IMPORT_MAX_TEXT_CODE_POINTS
  ) {
    collector.add({
      code: "TEXT_TOO_LONG",
      row: matchRow.line,
      column: "opponent",
      value: opponentName,
      message: `opponent exceeds ${IMPORT_MAX_TEXT_CODE_POINTS} characters.`,
    });
    opponentName = null;
  }
  requireBlank(
    matchRow,
    [
      "player_number",
      "player_name",
      "event_sequence",
      "half",
      "elapsed_seconds",
      "event_type",
      "event_group",
      "shot_goal",
      "shot_direction",
      "shot_aim",
      "shot_position",
      "substitution_player_in",
    ],
    "match",
  );

  // Player rows.
  const roster: CanonicalRosterPlayer[] = [];
  const rosterNumbers = new Set<number>();
  for (const row of playerRows) {
    const numberRaw = row.get("player_number");
    const number = parseStrictInt(numberRaw);
    if (number === null || number < 0) {
      collector.add({
        code: "INVALID_INTEGER",
        row: row.line,
        column: "player_number",
        value: numberRaw,
        message: "player_number must be a non-negative base-10 integer.",
      });
      continue;
    }
    const name = requireText(row, "player_name", "player_name");
    requireBlank(
      row,
      [
        "match_started_at",
        "tracked_team",
        "opponent",
        "event_sequence",
        "half",
        "elapsed_seconds",
        "event_type",
        "event_group",
        "shot_goal",
        "shot_direction",
        "shot_aim",
        "shot_position",
        "substitution_player_in",
      ],
      "player",
    );
    if (name === null) {
      continue;
    }
    if (rosterNumbers.has(number)) {
      collector.add({
        code: "DUPLICATE_PLAYER_NUMBER",
        row: row.line,
        column: "player_number",
        value: numberRaw,
        message: `Player number ${number} appears more than once in the roster.`,
      });
      continue;
    }
    rosterNumbers.add(number);
    roster.push({ number, name });
  }

  if (roster.length < IMPORT_MIN_PLAYERS || roster.length > IMPORT_MAX_PLAYERS) {
    collector.add({
      code: "ROSTER_SIZE",
      value: String(roster.length),
      message: `The roster must contain between ${IMPORT_MIN_PLAYERS} and ${IMPORT_MAX_PLAYERS} players; found ${roster.length}.`,
    });
  }

  if (eventRows.length > IMPORT_MAX_EVENTS) {
    collector.add({
      code: "TOO_MANY_EVENTS",
      value: String(eventRows.length),
      message: `The file has ${eventRows.length} events; the maximum is ${IMPORT_MAX_EVENTS}.`,
    });
    return { ok: false, diagnostics: collector.diagnostics };
  }

  // Event rows.
  const events: CandidateEvent[] = [];
  const sequences = new Set<number>();

  for (const row of eventRows) {
    requireBlank(
      row,
      ["match_started_at", "tracked_team", "opponent", "player_name"],
      "event",
    );

    if (
      matchExternalId !== null &&
      row.get("match_external_id") !== matchExternalId
    ) {
      collector.add({
        code: "MIXED_MATCH_IDENTITY",
        row: row.line,
        column: "match_external_id",
        value: row.get("match_external_id"),
        message: "All event rows must repeat the match_external_id of the match row.",
      });
    }

    const sequenceRaw = row.get("event_sequence");
    const sequence = parseStrictInt(sequenceRaw);
    if (sequence === null || sequence < 0) {
      collector.add({
        code: "INVALID_INTEGER",
        row: row.line,
        column: "event_sequence",
        value: sequenceRaw,
        message: "event_sequence must be a non-negative base-10 integer.",
      });
      continue;
    }
    if (sequences.has(sequence)) {
      collector.add({
        code: "DUPLICATE_EVENT_SEQUENCE",
        row: row.line,
        column: "event_sequence",
        value: sequenceRaw,
        message: `event_sequence ${sequence} appears more than once.`,
      });
      continue;
    }
    sequences.add(sequence);

    const playerRaw = row.get("player_number");
    const player = parseStrictInt(playerRaw);
    if (player === null || player < 0) {
      collector.add({
        code: "INVALID_INTEGER",
        row: row.line,
        column: "player_number",
        value: playerRaw,
        message: "player_number must be a non-negative base-10 integer.",
      });
      continue;
    }

    const halfRaw = row.get("half");
    const half = matchHalfSchema.safeParse(halfRaw);
    if (!half.success) {
      collector.add({
        code: "INVALID_ENUM",
        row: row.line,
        column: "half",
        value: halfRaw,
        message: 'half must be "firstHalf" or "secondHalf".',
      });
      continue;
    }

    const elapsedRaw = row.get("elapsed_seconds");
    const elapsed = parseStrictInt(elapsedRaw);
    if (elapsed === null || elapsed < 0) {
      collector.add({
        code: "INVALID_INTEGER",
        row: row.line,
        column: "elapsed_seconds",
        value: elapsedRaw,
        message: "elapsed_seconds must be a non-negative base-10 integer.",
      });
      continue;
    }

    const eventTypeRaw = row.get("event_type");
    const eventType = eventTypeSchema.safeParse(eventTypeRaw);
    if (!eventType.success) {
      collector.add({
        code: "INVALID_ENUM",
        row: row.line,
        column: "event_type",
        value: eventTypeRaw,
        message: `event_type must be one of: ${eventTypeSchema.options.join(", ")}.`,
      });
      continue;
    }

    const eventGroupRaw = row.get("event_group");
    const eventGroup = eventGroupSchema.safeParse(eventGroupRaw);
    if (!eventGroup.success) {
      collector.add({
        code: "INVALID_ENUM",
        row: row.line,
        column: "event_group",
        value: eventGroupRaw,
        message: `event_group must be one of: ${eventGroupSchema.options.join(", ")}.`,
      });
      continue;
    }

    const isShot = eventType.data === "shot";
    const isSubstitution = eventType.data === "substitution";

    if (!isShot) {
      requireBlank(
        row,
        ["shot_goal", "shot_direction", "shot_aim", "shot_position"],
        `${eventType.data} event`,
      );
    }
    if (!isSubstitution) {
      requireBlank(row, ["substitution_player_in"], `${eventType.data} event`);
    }

    const base = {
      id: 0,
      player,
      game_id: 0,
      ellapsed_seconds: elapsed,
      half: half.data,
      eventType: eventType.data,
      eventGroup: eventGroup.data,
    };

    let candidate: Record<string, unknown> = base;

    if (isShot) {
      const goalRaw = row.get("shot_goal");
      const goal = parseStrictBool(goalRaw);
      if (goal === null) {
        collector.add({
          code: "INVALID_BOOLEAN",
          row: row.line,
          column: "shot_goal",
          value: goalRaw,
          message: 'shot_goal must be "true" or "false" for shot events.',
        });
        continue;
      }

      const directionRaw = row.get("shot_direction");
      const direction = shotDirectionSchema.safeParse(directionRaw);
      if (!direction.success) {
        collector.add({
          code: "INVALID_ENUM",
          row: row.line,
          column: "shot_direction",
          value: directionRaw,
          message: `shot_direction must be one of: ${shotDirectionSchema.options.join(", ")}.`,
        });
        continue;
      }

      const positionRaw = row.get("shot_position");
      const position = shotPosition.safeParse(positionRaw);
      if (!position.success) {
        collector.add({
          code: "INVALID_ENUM",
          row: row.line,
          column: "shot_position",
          value: positionRaw,
          message: `shot_position must be one of: ${shotPosition.options.join(", ")}.`,
        });
        continue;
      }

      const aimRaw = row.get("shot_aim");
      let aim: string | undefined;
      if (aimRaw !== "") {
        const parsedAim = shotAimSchema.safeParse(aimRaw);
        if (!parsedAim.success) {
          collector.add({
            code: "INVALID_ENUM",
            row: row.line,
            column: "shot_aim",
            value: aimRaw,
            message: `shot_aim must be one of: ${shotAimSchema.options.join(", ")}.`,
          });
          continue;
        }
        aim = parsedAim.data;
      }

      candidate = {
        ...base,
        event: {
          goal,
          direction: direction.data,
          position: position.data,
          ...(aim !== undefined ? { aim } : {}),
        },
      };
    } else if (isSubstitution) {
      const playerInRaw = row.get("substitution_player_in");
      const playerIn = parseStrictInt(playerInRaw);
      if (playerIn === null || playerIn < 0) {
        collector.add({
          code: "INVALID_INTEGER",
          row: row.line,
          column: "substitution_player_in",
          value: playerInRaw,
          message:
            "substitution_player_in must be a non-negative base-10 integer for substitution events.",
        });
        continue;
      }
      candidate = { ...base, event: { playerIn } };
    }

    const parsed = playerEventSchema.safeParse(candidate);
    if (!parsed.success) {
      reportPlayerEventZodIssues(
        collector,
        row.line,
        parsed.error.issues,
        (path) => ZOD_PATH_TO_V1_COLUMN[path] ?? null,
      );
      continue;
    }

    events.push({ line: row.line, sequence, event: parsed.data });
  }

  crossRowChecks(
    collector,
    roster,
    events,
    "player_number",
    "substitution_player_in",
  );

  return finishResult(collector, () => ({
    formatVersion: ARCAZZI_GAME_V1,
    matchExternalId,
    // biome-ignore lint/style/noNonNullAssertion: errors above guarantee presence
    matchStartedAt: matchStartedAt!,
    // biome-ignore lint/style/noNonNullAssertion: errors above guarantee presence
    trackedTeamName: trackedTeamName!,
    opponentName,
    roster,
    events: events
      .sort((a, b) => a.sequence - b.sequence)
      .map<CanonicalImportEvent>(({ sequence, line, event }) => ({
        sequence,
        sourceRow: line,
        event,
      })),
    goalCount: countGoals(events),
  }));
}

export type LegacyImportMetadata = {
  /** YYYY-MM-DD match date supplied by the user. */
  matchDate: string;
  opponent: string | null;
  /** Selected owned team's display name (snapshot label). */
  teamName: string;
  /** Selected owned team's current roster, used to resolve player labels. */
  roster: CanonicalRosterPlayer[];
};

const LEGACY_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Validates a `legacy-event-log-v0` file into the canonical import model. */
export function validateLegacyEventLogV0(
  dataRows: RawCsvRow[],
  metadata: LegacyImportMetadata,
): ImportValidationResult {
  const collector = new DiagnosticCollector();

  if (!LEGACY_DATE.test(metadata.matchDate)) {
    collector.add({
      code: "INVALID_MATCH_DATE",
      value: metadata.matchDate,
      message: "The match date must use the YYYY-MM-DD format.",
    });
    return { ok: false, diagnostics: collector.diagnostics };
  }

  if (
    metadata.opponent !== null &&
    codePointLength(metadata.opponent) > IMPORT_MAX_TEXT_CODE_POINTS
  ) {
    collector.add({
      code: "TEXT_TOO_LONG",
      column: "opponent",
      value: metadata.opponent,
      message: `The opponent name exceeds ${IMPORT_MAX_TEXT_CODE_POINTS} characters.`,
    });
    return { ok: false, diagnostics: collector.diagnostics };
  }

  if (dataRows.length > IMPORT_MAX_EVENTS) {
    collector.add({
      code: "TOO_MANY_EVENTS",
      value: String(dataRows.length),
      message: `The file has ${dataRows.length} events; the maximum is ${IMPORT_MAX_EVENTS}.`,
    });
    return { ok: false, diagnostics: collector.diagnostics };
  }

  const rosterNumbers = new Set(
    metadata.roster.map((player) => player.number),
  );

  if (
    metadata.roster.length < IMPORT_MIN_PLAYERS ||
    metadata.roster.length > IMPORT_MAX_PLAYERS
  ) {
    collector.add({
      code: "ROSTER_SIZE",
      value: String(metadata.roster.length),
      message: `The selected team must have between ${IMPORT_MIN_PLAYERS} and ${IMPORT_MAX_PLAYERS} players; found ${metadata.roster.length}.`,
    });
  }

  const columnIndex = new Map(
    LEGACY_EVENT_LOG_V0_HEADERS.map((header, index) => [header, index]),
  );
  const cell = (row: RawCsvRow, column: string): string =>
    row.cells[columnIndex.get(column) ?? -1] ?? "";

  const events: CandidateEvent[] = [];
  let sequence = 0;

  for (const row of dataRows) {
    if (row.cells.length !== LEGACY_EVENT_LOG_V0_HEADERS.length) {
      collector.add({
        code: "WRONG_FIELD_COUNT",
        row: row.line,
        value: String(row.cells.length),
        message: `Row has ${row.cells.length} fields; expected ${LEGACY_EVENT_LOG_V0_HEADERS.length}.`,
      });
      continue;
    }

    const playerRaw = cell(row, "player");
    const player = parseStrictInt(playerRaw);
    if (player === null || player < 0) {
      collector.add({
        code: "INVALID_INTEGER",
        row: row.line,
        column: "player",
        value: playerRaw,
        message: "player must be a non-negative base-10 integer.",
      });
      continue;
    }
    if (!rosterNumbers.has(player)) {
      collector.add({
        code: "PLAYER_NOT_IN_ROSTER",
        row: row.line,
        column: "player",
        value: playerRaw,
        message: `Player ${player} is not on the selected team's current roster; legacy imports resolve player names from that roster.`,
      });
      continue;
    }

    const elapsedRaw = cell(row, "ellapsedSeconds");
    const elapsed = parseStrictInt(elapsedRaw);
    if (elapsed === null || elapsed < 0) {
      collector.add({
        code: "INVALID_INTEGER",
        row: row.line,
        column: "ellapsedSeconds",
        value: elapsedRaw,
        message: "ellapsedSeconds must be a non-negative base-10 integer.",
      });
      continue;
    }

    const halfRaw = cell(row, "half");
    const half = matchHalfSchema.safeParse(halfRaw);
    if (!half.success) {
      collector.add({
        code: "INVALID_ENUM",
        row: row.line,
        column: "half",
        value: halfRaw,
        message: 'half must be "firstHalf" or "secondHalf".',
      });
      continue;
    }

    const eventTypeRaw = cell(row, "eventType");
    const eventType = eventTypeSchema.safeParse(eventTypeRaw);
    if (!eventType.success) {
      collector.add({
        code: "INVALID_ENUM",
        row: row.line,
        column: "eventType",
        value: eventTypeRaw,
        message: `eventType must be one of: ${eventTypeSchema.options.join(", ")}.`,
      });
      continue;
    }

    const eventGroupRaw = cell(row, "eventGroup");
    const eventGroup = eventGroupSchema.safeParse(eventGroupRaw);
    if (!eventGroup.success) {
      collector.add({
        code: "INVALID_ENUM",
        row: row.line,
        column: "eventGroup",
        value: eventGroupRaw,
        message: `eventGroup must be one of: ${eventGroupSchema.options.join(", ")}.`,
      });
      continue;
    }

    const base = {
      id: 0,
      player,
      game_id: 0,
      ellapsed_seconds: elapsed,
      half: half.data,
      eventType: eventType.data,
      eventGroup: eventGroup.data,
    };

    let candidate: Record<string, unknown> = base;

    if (eventType.data === "shot") {
      const goalRaw = cell(row, "shotGoal");
      const goal = parseStrictBool(goalRaw);
      if (goal === null) {
        collector.add({
          code: "INVALID_BOOLEAN",
          row: row.line,
          column: "shotGoal",
          value: goalRaw,
          message: 'shotGoal must be "true" or "false" for shot events.',
        });
        continue;
      }
      const aimRaw = cell(row, "shotAim");
      candidate = {
        ...base,
        event: {
          goal,
          direction: cell(row, "shotDirection"),
          position: cell(row, "shotPosition"),
          ...(aimRaw !== "" ? { aim: aimRaw } : {}),
        },
      };
    } else if (eventType.data === "substitution") {
      const playerInRaw = cell(row, "substitutionPlayerIn");
      const playerIn = parseStrictInt(playerInRaw);
      if (playerIn === null || playerIn < 0) {
        collector.add({
          code: "INVALID_INTEGER",
          row: row.line,
          column: "substitutionPlayerIn",
          value: playerInRaw,
          message:
            "substitutionPlayerIn must be a non-negative base-10 integer for substitution events.",
        });
        continue;
      }
      candidate = { ...base, event: { playerIn } };
    }

    const parsed = playerEventSchema.safeParse(candidate);
    if (!parsed.success) {
      reportPlayerEventZodIssues(
        collector,
        row.line,
        parsed.error.issues,
        (path) => {
          const mapping: Record<string, string> = {
            player: "player",
            half: "half",
            ellapsed_seconds: "ellapsedSeconds",
            eventType: "eventType",
            eventGroup: "eventGroup",
            "event.goal": "shotGoal",
            "event.direction": "shotDirection",
            "event.aim": "shotAim",
            "event.position": "shotPosition",
            "event.playerIn": "substitutionPlayerIn",
          };
          return mapping[path] ?? null;
        },
      );
      continue;
    }

    events.push({ line: row.line, sequence, event: parsed.data });
    sequence += 1;
  }

  crossRowChecks(collector, metadata.roster, events, "player", "substitutionPlayerIn");

  return finishResult(collector, () => ({
    formatVersion: LEGACY_EVENT_LOG_V0,
    matchExternalId: null,
    matchStartedAt: legacyDateToTimestamp(metadata.matchDate),
    trackedTeamName: metadata.teamName,
    opponentName: metadata.opponent,
    roster: metadata.roster,
    events: events.map<CanonicalImportEvent>(
      ({ sequence: eventSequence, line, event }) => ({
        sequence: eventSequence,
        sourceRow: line,
        event,
      }),
    ),
    goalCount: countGoals(events),
  }));
}
