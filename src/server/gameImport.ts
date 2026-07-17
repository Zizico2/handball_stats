import { and, eq } from "drizzle-orm";
import type { AppDb } from "@/db";
import { playerEventToDbRow } from "@/db";
import * as schema from "@/db/schema";
import { ARCAZZI_GAME_V1, LEGACY_EVENT_LOG_V0 } from "@/gameImport/csvContract";
import { fingerprintCanonicalImport } from "@/gameImport/fingerprint";
import { sanitizeFilename } from "@/gameImport/sanitizeFilename";
import type { CanonicalGameImport, ImportDiagnostic } from "@/gameImport/types";
import {
  inspectCsv,
  validateArcazziGameV1,
  validateLegacyEventLogV0,
} from "@/gameImport/validate";
import { allocateLocalIds } from "@/server/allocateLocalId";

export type GameImportMetadata = {
  homeTeamId: number | null;
  /** YYYY-MM-DD; required for legacy files. */
  matchDate: string | null;
  opponent: string | null;
};

export type GameImportRequestInput = {
  fileText: string;
  filename: string;
  metadata: GameImportMetadata;
};

export type GameImportDuplicateStatus =
  | { kind: "none" }
  | { kind: "exact"; existingGameId: number }
  | { kind: "likely"; existingGameId: number };

export type GameImportPreview = {
  status: "ready";
  formatVersion: string;
  fingerprint: string;
  sanitizedFilename: string;
  homeTeamId: number;
  trackedTeamName: string;
  opponentName: string | null;
  matchStartedAt: string;
  playerCount: number;
  eventCount: number;
  goalCount: number;
  warnings: ImportDiagnostic[];
  duplicate: GameImportDuplicateStatus;
};

export type GameImportPrepareResult =
  | { status: "needs_metadata"; formatVersion: string; missing: string[] }
  | { status: "invalid"; diagnostics: ImportDiagnostic[] }
  | (GameImportPreview & { canonical: CanonicalGameImport });

export class GameImportTeamNotFoundError extends Error {
  constructor(teamId: number) {
    super(`Team ${teamId} not found`);
    this.name = "GameImportTeamNotFoundError";
  }
}

export class GameImportExactDuplicateError extends Error {
  constructor(readonly existingGameId: number) {
    super("This file was already imported");
    this.name = "GameImportExactDuplicateError";
  }
}

export class GameImportLikelyDuplicateError extends Error {
  constructor(readonly existingGameId: number) {
    super(
      "A game with the same team, date and opponent already exists. Confirm with allowLikelyDuplicate to import anyway.",
    );
    this.name = "GameImportLikelyDuplicateError";
  }
}

export class GameImportStalePreviewError extends Error {
  constructor() {
    super("The file or metadata changed since the preview. Preview again.");
    this.name = "GameImportStalePreviewError";
  }
}

export class GameImportInvalidError extends Error {
  constructor(readonly diagnostics: ImportDiagnostic[]) {
    super("The file failed validation");
    this.name = "GameImportInvalidError";
  }
}

async function loadOwnedTeam(db: AppDb, userId: string, teamId: number) {
  return db
    .select()
    .from(schema.teams)
    .where(
      and(eq(schema.teams.userId, userId), eq(schema.teams.localId, teamId)),
    )
    .get();
}

async function findDuplicate(
  db: AppDb,
  userId: string,
  fingerprint: string,
  canonical: CanonicalGameImport,
  homeTeamId: number,
): Promise<GameImportDuplicateStatus> {
  const exact = await db
    .select({ gameLocalId: schema.gameImports.gameLocalId })
    .from(schema.gameImports)
    .where(
      and(
        eq(schema.gameImports.userId, userId),
        eq(schema.gameImports.fingerprint, fingerprint),
      ),
    )
    .get();

  if (exact) {
    return { kind: "exact", existingGameId: exact.gameLocalId };
  }

  // Likely duplicate: same team + same normalized match date + same opponent.
  const matchDate = canonical.matchStartedAt.slice(0, 10);
  const candidates = await db
    .select({
      localId: schema.games.localId,
      createdAt: schema.games.createdAt,
      opponentName: schema.games.opponentName,
    })
    .from(schema.games)
    .where(
      and(
        eq(schema.games.userId, userId),
        eq(schema.games.homeTeamLocalId, homeTeamId),
        eq(schema.games.source, "imported"),
      ),
    );

  const likely = candidates.find(
    (game) =>
      game.createdAt.slice(0, 10) === matchDate &&
      (game.opponentName ?? null) === canonical.opponentName,
  );

  if (likely) {
    return { kind: "likely", existingGameId: likely.localId };
  }

  return { kind: "none" };
}

/**
 * Pure-ish preparation boundary: parses, validates, checks ownership and
 * duplicates without writing anything.
 */
export async function prepareGameImport(
  db: AppDb,
  userId: string,
  input: GameImportRequestInput,
): Promise<GameImportPrepareResult> {
  const inspection = inspectCsv(input.fileText);

  if (!inspection.ok) {
    return { status: "invalid", diagnostics: inspection.diagnostics };
  }

  const { metadata } = input;

  const missing: string[] = [];
  if (metadata.homeTeamId === null) {
    missing.push("homeTeamId");
  }
  if (
    inspection.format === LEGACY_EVENT_LOG_V0 &&
    metadata.matchDate === null
  ) {
    missing.push("matchDate");
  }
  if (missing.length > 0) {
    return {
      status: "needs_metadata",
      formatVersion: inspection.format,
      missing,
    };
  }

  const homeTeamId = metadata.homeTeamId as number;
  const team = await loadOwnedTeam(db, userId, homeTeamId);
  if (!team) {
    throw new GameImportTeamNotFoundError(homeTeamId);
  }

  let result: ReturnType<typeof validateArcazziGameV1>;
  if (inspection.format === ARCAZZI_GAME_V1) {
    result = validateArcazziGameV1(inspection.dataRows);
  } else {
    const rosterRows = await db
      .select({
        number: schema.teamPlayers.number,
        name: schema.teamPlayers.name,
      })
      .from(schema.teamPlayers)
      .where(
        and(
          eq(schema.teamPlayers.userId, userId),
          eq(schema.teamPlayers.teamLocalId, homeTeamId),
        ),
      );

    result = validateLegacyEventLogV0(inspection.dataRows, {
      matchDate: metadata.matchDate as string,
      opponent: metadata.opponent,
      teamName: team.name,
      roster: rosterRows,
    });
  }

  if (!result.ok) {
    return { status: "invalid", diagnostics: result.diagnostics };
  }

  const fingerprint = await fingerprintCanonicalImport(result.canonical);
  const duplicate = await findDuplicate(
    db,
    userId,
    fingerprint,
    result.canonical,
    homeTeamId,
  );

  return {
    status: "ready",
    canonical: result.canonical,
    formatVersion: result.canonical.formatVersion,
    fingerprint,
    sanitizedFilename: sanitizeFilename(input.filename),
    homeTeamId,
    trackedTeamName: result.canonical.trackedTeamName,
    opponentName: result.canonical.opponentName,
    matchStartedAt: result.canonical.matchStartedAt,
    playerCount: result.canonical.roster.length,
    eventCount: result.canonical.events.length,
    goalCount: result.canonical.goalCount,
    warnings: result.warnings,
    duplicate,
  };
}

export type PersistImportedGameInput = {
  canonical: CanonicalGameImport;
  homeTeamId: number;
  fingerprint: string;
  sanitizedFilename: string;
  importedAt: string;
};

/**
 * Persists an already validated imported game in one D1 `db.batch()`
 * (all-or-nothing): game (source=imported, no active marker), roster
 * snapshot rows, event rows and one provenance row. Never touches
 * `active_game` or the live roster.
 */
export async function persistImportedGameAtomic(
  db: AppDb,
  userId: string,
  input: PersistImportedGameInput,
): Promise<{ gameId: number }> {
  const { canonical } = input;

  const [gameId, provenanceId, ...rowIds] = allocateLocalIds(
    2 + canonical.roster.length + canonical.events.length,
  );
  const snapshotIds = rowIds.slice(0, canonical.roster.length);
  const eventIds = rowIds.slice(canonical.roster.length);

  const gameRow: typeof schema.games.$inferInsert = {
    userId,
    localId: gameId,
    homeTeamLocalId: input.homeTeamId,
    createdAt: canonical.matchStartedAt,
    firstHalfStartedAtMs: null,
    halftimeStartedAtMs: null,
    secondHalfStartedAtMs: null,
    source: "imported",
    opponentName: canonical.opponentName,
    trackedTeamName: canonical.trackedTeamName,
  };

  const snapshotRows = canonical.roster.map((player, index) => ({
    userId,
    localId: snapshotIds[index],
    gameLocalId: gameId,
    playerNumber: player.number,
    playerName: player.name,
  }));

  const eventRows = canonical.events.map((entry, index) =>
    playerEventToDbRow(
      { ...entry.event, id: eventIds[index], game_id: gameId },
      userId,
    ),
  );

  const provenanceRow: typeof schema.gameImports.$inferInsert = {
    userId,
    localId: provenanceId,
    gameLocalId: gameId,
    formatVersion: canonical.formatVersion,
    fingerprint: input.fingerprint,
    originalFilename: input.sanitizedFilename,
    importedAt: input.importedAt,
  };

  const statements = [
    db.insert(schema.games).values(gameRow),
    ...(snapshotRows.length > 0
      ? [db.insert(schema.gameRosterSnapshots).values(snapshotRows)]
      : []),
    ...(eventRows.length > 0
      ? [db.insert(schema.playerEvents).values(eventRows)]
      : []),
    db.insert(schema.gameImports).values(provenanceRow),
  ] as const;

  await db.batch([statements[0], ...statements.slice(1)]);

  return { gameId };
}

function isUniqueConstraintError(error: unknown): boolean {
  const message =
    error && typeof error === "object" && "message" in error
      ? String((error as { message: unknown }).message)
      : String(error);
  return /unique constraint failed/i.test(message);
}

export type ConfirmGameImportInput = GameImportRequestInput & {
  previewFingerprint: string;
  allowLikelyDuplicate: boolean;
};

/**
 * Re-validates the uploaded file and metadata from scratch, verifies the
 * preview fingerprint, enforces duplicate policy, and persists atomically.
 */
export async function confirmGameImport(
  db: AppDb,
  userId: string,
  input: ConfirmGameImportInput,
): Promise<{ gameId: number }> {
  const prepared = await prepareGameImport(db, userId, input);

  if (prepared.status === "invalid") {
    throw new GameImportInvalidError(prepared.diagnostics);
  }
  if (prepared.status === "needs_metadata") {
    throw new GameImportInvalidError([
      {
        code: "MISSING_METADATA",
        severity: "error",
        row: null,
        column: null,
        value: null,
        message: `Missing required metadata: ${prepared.missing.join(", ")}.`,
      },
    ]);
  }

  if (prepared.fingerprint !== input.previewFingerprint) {
    throw new GameImportStalePreviewError();
  }

  if (prepared.duplicate.kind === "exact") {
    throw new GameImportExactDuplicateError(prepared.duplicate.existingGameId);
  }
  if (prepared.duplicate.kind === "likely" && !input.allowLikelyDuplicate) {
    throw new GameImportLikelyDuplicateError(prepared.duplicate.existingGameId);
  }

  try {
    return await persistImportedGameAtomic(db, userId, {
      canonical: prepared.canonical,
      homeTeamId: prepared.homeTeamId,
      fingerprint: prepared.fingerprint,
      sanitizedFilename: prepared.sanitizedFilename,
      importedAt: new Date().toISOString(),
    });
  } catch (error) {
    // Two racing confirms: the unique (user_id, fingerprint) index is the
    // final authority; map the loser to the exact-duplicate conflict.
    if (isUniqueConstraintError(error)) {
      const existing = await db
        .select({ gameLocalId: schema.gameImports.gameLocalId })
        .from(schema.gameImports)
        .where(
          and(
            eq(schema.gameImports.userId, userId),
            eq(schema.gameImports.fingerprint, prepared.fingerprint),
          ),
        )
        .get();
      if (existing) {
        throw new GameImportExactDuplicateError(existing.gameLocalId);
      }
    }
    throw error;
  }
}
