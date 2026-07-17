import { PLAYER_EVENTS_CSV_COLUMN_KEYS } from "@/db/playerEventCsv";

/**
 * Shared, versioned CSV contract used by import, export, template, docs and
 * tests. Public headers are defined here explicitly; never derive them from
 * database column names.
 */

export const ARCAZZI_GAME_V1 = "arcazzi-game-v1" as const;
export const LEGACY_EVENT_LOG_V0 = "legacy-event-log-v0" as const;

export type ImportFormatVersion =
  | typeof ARCAZZI_GAME_V1
  | typeof LEGACY_EVENT_LOG_V0;

/** Exact v1 header order. Do not reorder without a new format version. */
export const ARCAZZI_GAME_V1_HEADERS = [
  "format_version",
  "record_type",
  "match_external_id",
  "match_started_at",
  "tracked_team",
  "opponent",
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
] as const;

export type ArcazziGameV1Header = (typeof ARCAZZI_GAME_V1_HEADERS)[number];

export const V1_RECORD_TYPES = ["match", "player", "event"] as const;
export type V1RecordType = (typeof V1_RECORD_TYPES)[number];

/**
 * The exact current unversioned event-log export header, preserved for
 * legacy compatibility.
 */
export const LEGACY_EVENT_LOG_V0_HEADERS = PLAYER_EVENTS_CSV_COLUMN_KEYS.map(
  (key) => String(key),
);

// Limits (referenced by UI copy, server validation, docs and tests).
export const IMPORT_MAX_FILE_BYTES = 2 * 1024 * 1024; // 2 MiB
export const IMPORT_MAX_DATA_ROWS = 5000;
export const IMPORT_MIN_PLAYERS = 1;
export const IMPORT_MAX_PLAYERS = 100;
export const IMPORT_MIN_EVENTS = 0;
export const IMPORT_MAX_EVENTS = 4000;
export const IMPORT_MAX_TEXT_CODE_POINTS = 100;
export const IMPORT_MAX_FILENAME_CODE_POINTS = 255;
export const IMPORT_MAX_DIAGNOSTIC_VALUE_CODE_POINTS = 100;
export const IMPORT_MAX_ERRORS = 100;

/** Documented noon-UTC anchor for legacy date-only input. */
export function legacyDateToTimestamp(date: string): string {
  return `${date}T12:00:00.000Z`;
}
