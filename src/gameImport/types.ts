import type { PlayerEvent } from "@/datamodel";
import type { ImportFormatVersion } from "./csvContract";

export type ImportDiagnosticSeverity = "error" | "warning";

export type ImportDiagnostic = {
  code: string;
  severity: ImportDiagnosticSeverity;
  /** 1-based physical CSV line, null for file-level diagnostics. */
  row: number | null;
  column: string | null;
  /** Text only, capped; never HTML. */
  value: string | null;
  /** Actionable remediation message. */
  message: string;
};

export type CanonicalRosterPlayer = {
  number: number;
  name: string;
};

/**
 * A validated event ready for persistence. `event` carries a fully
 * domain-validated `PlayerEvent` with placeholder `id`/`game_id` values (0);
 * real IDs are allocated server-side at confirm time.
 */
export type CanonicalImportEvent = {
  sequence: number;
  sourceRow: number;
  event: PlayerEvent;
};

export type CanonicalGameImport = {
  formatVersion: ImportFormatVersion;
  matchExternalId: string | null;
  /** ISO 8601 UTC timestamp. */
  matchStartedAt: string;
  /** Snapshot label from the file (v1) or the selected team (legacy). */
  trackedTeamName: string;
  opponentName: string | null;
  roster: CanonicalRosterPlayer[];
  events: CanonicalImportEvent[];
  goalCount: number;
};

export type ImportValidationSuccess = {
  ok: true;
  canonical: CanonicalGameImport;
  warnings: ImportDiagnostic[];
};

export type ImportValidationFailure = {
  ok: false;
  diagnostics: ImportDiagnostic[];
};

export type ImportValidationResult =
  | ImportValidationSuccess
  | ImportValidationFailure;
