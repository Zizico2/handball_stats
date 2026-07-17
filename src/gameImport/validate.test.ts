import { describe, expect, test } from "bun:test";
import {
  ARCAZZI_GAME_V1,
  IMPORT_MAX_ERRORS,
  LEGACY_EVENT_LOG_V0,
} from "./csvContract";
import { fingerprintCanonicalImport } from "./fingerprint";
import {
  LEGACY_ROSTER,
  V1_HEADER_LINE,
  VALID_LEGACY_FIXTURE,
  VALID_V1_FIXTURE,
} from "./fixtures";
import type { ImportValidationResult } from "./types";
import {
  inspectCsv,
  validateArcazziGameV1,
  validateLegacyEventLogV0,
} from "./validate";

function validateV1Text(text: string): ImportValidationResult {
  const inspection = inspectCsv(text);
  if (!inspection.ok) {
    return { ok: false, diagnostics: inspection.diagnostics };
  }
  expect(inspection.format).toBe(ARCAZZI_GAME_V1);
  return validateArcazziGameV1(inspection.dataRows);
}

function expectOk(result: ImportValidationResult) {
  if (!result.ok) {
    throw new Error(
      `expected ok, got diagnostics: ${JSON.stringify(result.diagnostics, null, 2)}`,
    );
  }
  return result;
}

function expectError(result: ImportValidationResult, code: string) {
  expect(result.ok).toBe(false);
  if (result.ok) return;
  expect(result.diagnostics.map((d) => d.code)).toContain(code);
}

describe("inspectCsv", () => {
  test("detects v1 and legacy headers", () => {
    const v1 = inspectCsv(VALID_V1_FIXTURE);
    expect(v1.ok && v1.format).toBe(ARCAZZI_GAME_V1);

    const legacy = inspectCsv(VALID_LEGACY_FIXTURE);
    expect(legacy.ok && legacy.format).toBe(LEGACY_EVENT_LOG_V0);
  });

  test("accepts a UTF-8 BOM and CRLF line endings", () => {
    const text = `\uFEFF${VALID_V1_FIXTURE.replaceAll("\n", "\r\n")}`;
    const inspection = inspectCsv(text);
    expect(inspection.ok && inspection.format).toBe(ARCAZZI_GAME_V1);
  });

  test("rejects NUL bytes", () => {
    const inspection = inspectCsv(`${VALID_V1_FIXTURE}\u0000`);
    expect(inspection.ok).toBe(false);
    if (!inspection.ok) {
      expect(inspection.diagnostics[0].code).toBe("INVALID_BYTES");
    }
  });

  test("rejects malformed quoting", () => {
    const inspection = inspectCsv(`${V1_HEADER_LINE}\n"unterminated`);
    expect(inspection.ok).toBe(false);
    if (!inspection.ok) {
      expect(inspection.diagnostics[0].code).toBe("CSV_PARSE_ERROR");
    }
  });

  test("rejects unknown headers", () => {
    const inspection = inspectCsv("foo,bar\n1,2\n");
    expect(inspection.ok).toBe(false);
    if (!inspection.ok) {
      expect(inspection.diagnostics[0].code).toBe("UNSUPPORTED_FORMAT");
    }
  });

  test("rejects duplicate headers", () => {
    const inspection = inspectCsv("foo,foo\n1,2\n");
    expect(inspection.ok).toBe(false);
    if (!inspection.ok) {
      expect(inspection.diagnostics[0].code).toBe("DUPLICATE_HEADER");
    }
  });

  test("rejects empty and header-only files", () => {
    const empty = inspectCsv("");
    expect(empty.ok).toBe(false);

    const headerOnly = inspectCsv(`${V1_HEADER_LINE}\n`);
    expect(headerOnly.ok).toBe(false);
    if (!headerOnly.ok) {
      expect(headerOnly.diagnostics[0].code).toBe("NO_DATA_ROWS");
    }
  });

  test("rejects too many rows", () => {
    const rows = Array.from(
      { length: 5001 },
      (_, i) =>
        `arcazzi-game-v1,event,match-1,,,,7,,${i},firstHalf,${i},interception,defense,,,,,`,
    );
    const inspection = inspectCsv(`${V1_HEADER_LINE}\n${rows.join("\n")}\n`);
    expect(inspection.ok).toBe(false);
    if (!inspection.ok) {
      expect(inspection.diagnostics[0].code).toBe("TOO_MANY_ROWS");
    }
  });
});

describe("validateArcazziGameV1", () => {
  test("accepts the valid fixture and builds the canonical model", () => {
    const result = expectOk(validateV1Text(VALID_V1_FIXTURE));
    expect(result.canonical.formatVersion).toBe(ARCAZZI_GAME_V1);
    expect(result.canonical.matchExternalId).toBe("match-1");
    expect(result.canonical.matchStartedAt).toBe("2026-03-01T18:30:00.000Z");
    expect(result.canonical.trackedTeamName).toBe("Arcazzi");
    expect(result.canonical.opponentName).toBe("Rivals HC");
    expect(result.canonical.roster).toHaveLength(3);
    expect(result.canonical.events).toHaveLength(4);
    expect(result.canonical.goalCount).toBe(1);
  });

  test("accepts quoted commas and escaped quotes", () => {
    const text = VALID_V1_FIXTURE.replace(
      "Arcazzi,Rivals HC",
      '"Arcazzi, HC","Rivals ""B"""',
    );
    const result = expectOk(validateV1Text(text));
    expect(result.canonical.trackedTeamName).toBe("Arcazzi, HC");
    expect(result.canonical.opponentName).toBe('Rivals "B"');
  });

  test("rejects wrong field counts", () => {
    const text = `${V1_HEADER_LINE}\narcazzi-game-v1,match,x\n`;
    expectError(validateV1Text(text), "WRONG_FIELD_COUNT");
  });

  test("rejects unsupported versions", () => {
    const text = VALID_V1_FIXTURE.replaceAll(
      "arcazzi-game-v1,match",
      "arcazzi-game-v2,match",
    );
    expectError(validateV1Text(text), "UNSUPPORTED_VERSION");
  });

  test("rejects unknown record types", () => {
    const text = VALID_V1_FIXTURE.replace(
      "arcazzi-game-v1,player,,,,,7",
      "arcazzi-game-v1,roster,,,,,7",
    );
    expectError(validateV1Text(text), "UNKNOWN_RECORD_TYPE");
  });

  test("rejects zero or multiple match rows", () => {
    const noMatch = VALID_V1_FIXTURE.split("\n")
      .filter((line) => !line.includes(",match,"))
      .join("\n");
    expectError(validateV1Text(noMatch), "MATCH_ROW_COUNT");

    const doubled = VALID_V1_FIXTURE.replace(
      "arcazzi-game-v1,match,match-1,2026-03-01T18:30:00Z,Arcazzi,Rivals HC,,,,,,,,,,,,",
      "arcazzi-game-v1,match,match-1,2026-03-01T18:30:00Z,Arcazzi,Rivals HC,,,,,,,,,,,,\narcazzi-game-v1,match,match-1,2026-03-01T18:30:00Z,Arcazzi,Rivals HC,,,,,,,,,,,,",
    );
    expectError(validateV1Text(doubled), "MATCH_ROW_COUNT");
  });

  test("rejects invalid timestamps", () => {
    const text = VALID_V1_FIXTURE.replace(
      "2026-03-01T18:30:00Z",
      "2026-03-01 18:30",
    );
    expectError(validateV1Text(text), "INVALID_TIMESTAMP");
  });

  test("rejects invalid integers and booleans", () => {
    expectError(
      validateV1Text(
        VALID_V1_FIXTURE.replace(",0,firstHalf,95,", ",0,firstHalf,9.5,"),
      ),
      "INVALID_INTEGER",
    );
    expectError(
      validateV1Text(
        VALID_V1_FIXTURE.replace(",true,OnTarget,", ",yes,OnTarget,"),
      ),
      "INVALID_BOOLEAN",
    );
  });

  test("rejects invalid enums", () => {
    expectError(
      validateV1Text(VALID_V1_FIXTURE.replace("firstHalf,95", "thirdHalf,95")),
      "INVALID_ENUM",
    );
    expectError(
      validateV1Text(
        VALID_V1_FIXTURE.replace("OnTarget,TopLeft", "Sideways,TopLeft"),
      ),
      "INVALID_ENUM",
    );
  });

  test("rejects domain-invalid shots via playerEventSchema", () => {
    // Off-target goal.
    const offTargetGoal = VALID_V1_FIXTURE.replace(
      "1,firstHalf,240,shot,attack,false,OffTarget,,6m+,",
      "1,firstHalf,240,shot,attack,true,OffTarget,,6m+,",
    );
    const result = validateV1Text(offTargetGoal);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const diagnostic = result.diagnostics.find(
        (d) => d.code === "INVALID_EVENT",
      );
      expect(diagnostic?.column).toBe("shot_goal");
    }

    // Aim on a non-on-target shot.
    expectError(
      validateV1Text(
        VALID_V1_FIXTURE.replace(
          "false,OffTarget,,6m+",
          "false,OffTarget,TopLeft,6m+",
        ),
      ),
      "INVALID_EVENT",
    );
  });

  test("rejects forbidden populated cells", () => {
    // Shot columns on a non-shot event.
    expectError(
      validateV1Text(
        VALID_V1_FIXTURE.replace(
          "3,secondHalf,300,interception,defense,,,,,",
          "3,secondHalf,300,interception,defense,true,,,,",
        ),
      ),
      "FORBIDDEN_CELL_POPULATED",
    );
  });

  test("rejects duplicate player numbers and event sequences", () => {
    expectError(
      validateV1Text(
        VALID_V1_FIXTURE.replace(",9,Bruna Costa,", ",7,Bruna Costa,"),
      ),
      "DUPLICATE_PLAYER_NUMBER",
    );
    expectError(
      validateV1Text(
        VALID_V1_FIXTURE.replace(
          ",9,,1,firstHalf,240,",
          ",9,,0,firstHalf,240,",
        ),
      ),
      "DUPLICATE_EVENT_SEQUENCE",
    );
  });

  test("rejects mixed match identity", () => {
    expectError(
      validateV1Text(
        VALID_V1_FIXTURE.replace(
          "arcazzi-game-v1,event,match-1,,,,11",
          "arcazzi-game-v1,event,match-2,,,,11",
        ),
      ),
      "MIXED_MATCH_IDENTITY",
    );
  });

  test("rejects players missing from the roster", () => {
    expectError(
      validateV1Text(
        VALID_V1_FIXTURE.replace(
          "arcazzi-game-v1,event,match-1,,,,11,,3",
          "arcazzi-game-v1,event,match-1,,,,42,,3",
        ),
      ),
      "PLAYER_NOT_IN_ROSTER",
    );
  });

  test("rejects same-player substitutions", () => {
    expectError(
      validateV1Text(
        VALID_V1_FIXTURE.replace(
          "2,secondHalf,120,substitution,substitution,,,,,11",
          "2,secondHalf,120,substitution,substitution,,,,,7",
        ),
      ),
      "SUBSTITUTION_SAME_PLAYER",
    );
  });

  test("rejects decreasing elapsed seconds within a half", () => {
    expectError(
      validateV1Text(
        VALID_V1_FIXTURE.replace(",1,firstHalf,240,", ",1,firstHalf,10,"),
      ),
      "ELAPSED_DECREASED",
    );
  });

  test("rejects first-half events after second-half sequences", () => {
    const text = VALID_V1_FIXTURE.replace(
      ",9,,1,firstHalf,240,",
      ",9,,9,firstHalf,240,",
    );
    expectError(validateV1Text(text), "HALF_ORDER_VIOLATION");
  });

  test("warns when the starting lineup is incomplete", () => {
    const withStarters = VALID_V1_FIXTURE.replace(
      "arcazzi-game-v1,event,match-1,,,,7,,0,firstHalf,95,shot,attack,true,OnTarget,TopLeft,9m+,",
      [
        "arcazzi-game-v1,event,match-1,,,,7,,10,firstHalf,0,startingPlayer,substitution,,,,,",
        "arcazzi-game-v1,event,match-1,,,,7,,0,firstHalf,95,shot,attack,true,OnTarget,TopLeft,9m+,",
      ].join("\n"),
    ).replace(",9,,1,firstHalf,240,", ",9,,11,secondHalf,240,");
    // Rebuild a clean fixture: single starter in firstHalf at elapsed 0.
    const lines = [
      V1_HEADER_LINE,
      "arcazzi-game-v1,match,match-1,2026-03-01T18:30:00Z,Arcazzi,,,,,,,,,,,,,",
      "arcazzi-game-v1,player,,,,,7,Ana Silva,,,,,,,,,,",
      "arcazzi-game-v1,player,,,,,9,Bruna Costa,,,,,,,,,,",
      "arcazzi-game-v1,event,match-1,,,,7,,0,firstHalf,0,startingPlayer,substitution,,,,,",
      "arcazzi-game-v1,event,match-1,,,,9,,1,firstHalf,50,interception,defense,,,,,",
      "",
    ].join("\n");
    void withStarters;
    const result = expectOk(validateV1Text(lines));
    expect(result.warnings.map((w) => w.code)).toContain(
      "LINEUP_REPLAY_SKIPPED",
    );
  });

  test("rejects nonzero starting-player elapsed and duplicates", () => {
    const lines = [
      V1_HEADER_LINE,
      "arcazzi-game-v1,match,match-1,2026-03-01T18:30:00Z,Arcazzi,,,,,,,,,,,,,",
      "arcazzi-game-v1,player,,,,,7,Ana Silva,,,,,,,,,,",
      "arcazzi-game-v1,event,match-1,,,,7,,0,firstHalf,5,startingPlayer,substitution,,,,,",
      "arcazzi-game-v1,event,match-1,,,,7,,1,firstHalf,5,startingPlayer,substitution,,,,,",
      "",
    ].join("\n");
    const result = validateV1Text(lines);
    expectError(result, "STARTING_PLAYER_NOT_AT_ZERO");
    expectError(result, "DUPLICATE_STARTING_PLAYER");
  });

  test("replays substitutions when the lineup is complete", () => {
    const players = [1, 2, 3, 4, 5, 6, 7, 8];
    const playerLines = players.map(
      (n) => `arcazzi-game-v1,player,,,,,${n},Player ${n},,,,,,,,,,`,
    );
    const starterLines = players
      .slice(0, 7)
      .map(
        (n, i) =>
          `arcazzi-game-v1,event,match-1,,,,${n},,${i},firstHalf,0,startingPlayer,substitution,,,,,`,
      );
    // Player 8 is not on court but is substituted out: invalid.
    const badSub =
      "arcazzi-game-v1,event,match-1,,,,8,,7,firstHalf,100,substitution,substitution,,,,,1";
    const lines = [
      V1_HEADER_LINE,
      "arcazzi-game-v1,match,match-1,2026-03-01T18:30:00Z,Arcazzi,,,,,,,,,,,,,",
      ...playerLines,
      ...starterLines,
      badSub,
      "",
    ].join("\n");
    expectError(validateV1Text(lines), "SUBSTITUTION_PLAYER_OFF_COURT");
  });

  test("caps errors with TOO_MANY_ERRORS", () => {
    const badEvents = Array.from(
      { length: IMPORT_MAX_ERRORS + 20 },
      (_, i) =>
        `arcazzi-game-v1,event,match-1,,,,7,,${i},firstHalf,x,interception,defense,,,,,`,
    );
    const lines = [
      V1_HEADER_LINE,
      "arcazzi-game-v1,match,match-1,2026-03-01T18:30:00Z,Arcazzi,,,,,,,,,,,,,",
      "arcazzi-game-v1,player,,,,,7,Ana Silva,,,,,,,,,,",
      ...badEvents,
      "",
    ].join("\n");
    const result = validateV1Text(lines);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const codes = result.diagnostics.map((d) => d.code);
      expect(codes[codes.length - 1]).toBe("TOO_MANY_ERRORS");
      expect(
        codes.filter((code) => code !== "TOO_MANY_ERRORS").length,
      ).toBeLessThanOrEqual(IMPORT_MAX_ERRORS);
    }
  });

  test("formula and markup strings remain inert data", () => {
    const text = VALID_V1_FIXTURE.replace(
      "Rivals HC",
      '"=HYPERLINK(""http://evil"")"',
    ).replace("Ana Silva", "<img onerror=alert(1)>");
    const result = expectOk(validateV1Text(text));
    expect(result.canonical.opponentName).toBe('=HYPERLINK("http://evil")');
    expect(result.canonical.roster[0].name).toBe("<img onerror=alert(1)>");
  });
});

describe("validateLegacyEventLogV0", () => {
  function validateLegacy(
    text: string,
    metadata: Parameters<typeof validateLegacyEventLogV0>[1] = {
      matchDate: "2026-03-01",
      opponent: "Rivals HC",
      teamName: "Arcazzi",
      roster: LEGACY_ROSTER,
    },
  ) {
    const inspection = inspectCsv(text);
    if (!inspection.ok) {
      return { ok: false as const, diagnostics: inspection.diagnostics };
    }
    return validateLegacyEventLogV0(inspection.dataRows, metadata);
  }

  test("accepts a valid legacy file with supplied metadata", () => {
    const result = expectOk(validateLegacy(VALID_LEGACY_FIXTURE));
    expect(result.canonical.formatVersion).toBe(LEGACY_EVENT_LOG_V0);
    expect(result.canonical.matchStartedAt).toBe("2026-03-01T12:00:00.000Z");
    expect(result.canonical.trackedTeamName).toBe("Arcazzi");
    expect(result.canonical.roster).toEqual(LEGACY_ROSTER);
    expect(result.canonical.events).toHaveLength(3);
    expect(result.canonical.goalCount).toBe(1);
  });

  test("rejects player numbers missing from the selected roster", () => {
    const result = validateLegacy(
      VALID_LEGACY_FIXTURE.replace("7,95,shot", "42,95,shot"),
    );
    expectError(result, "PLAYER_NOT_IN_ROSTER");
  });

  test("rejects an invalid match date", () => {
    const result = validateLegacy(VALID_LEGACY_FIXTURE, {
      matchDate: "03/01/2026",
      opponent: null,
      teamName: "Arcazzi",
      roster: LEGACY_ROSTER,
    });
    expectError(result, "INVALID_MATCH_DATE");
  });
});

describe("fingerprintCanonicalImport", () => {
  test("is stable across cosmetic variants and sensitive to semantics", async () => {
    const base = expectOk(validateV1Text(VALID_V1_FIXTURE)).canonical;
    const bomCrlf = expectOk(
      validateV1Text(`\uFEFF${VALID_V1_FIXTURE.replaceAll("\n", "\r\n")}`),
    ).canonical;
    const changed = expectOk(
      validateV1Text(VALID_V1_FIXTURE.replace("Rivals HC", "Other Club")),
    ).canonical;

    const [a, b, c, aAgain] = await Promise.all([
      fingerprintCanonicalImport(base),
      fingerprintCanonicalImport(bomCrlf),
      fingerprintCanonicalImport(changed),
      fingerprintCanonicalImport(base),
    ]);

    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(b).toBe(a);
    expect(aAgain).toBe(a);
    expect(c).not.toBe(a);
  });
});
