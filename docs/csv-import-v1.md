# Arcazzi game CSV — `arcazzi-game-v1`

This document describes the versioned CSV format used by **Import game from
CSV** (Past Games) and by the past-game CSV export. Export and import share
one serializer/validator (`src/gameImport`), so the formats cannot diverge.

A downloadable template lives at [`/examples/arcazzi-game-v1.csv`](/examples/arcazzi-game-v1.csv).

## File rules

- RFC 4180 CSV, UTF-8 (an optional BOM is accepted), LF or CRLF line endings.
- Quoted cells, embedded commas/newlines, and escaped quotes (`""`) follow RFC 4180.
- Rejected: invalid UTF-8, NUL bytes, duplicate headers, unknown header sets,
  rows with the wrong number of fields.
- Limits: file ≤ 2 MiB; ≤ 5,000 non-blank data rows; 1–100 roster players;
  0–4,000 events; team/opponent/player names ≤ 100 Unicode code points;
  filename ≤ 255 code points. At most 100 errors are reported, then
  `TOO_MANY_ERRORS`.
- CSV values are data only. On export, cells starting with `=`, `+`, `-`, `@`,
  a tab, or a carriage return are prefixed with `'` so spreadsheets do not
  execute them; stored values are unchanged.

## Header (exact order)

```text
format_version,record_type,match_external_id,match_started_at,tracked_team,opponent,player_number,player_name,event_sequence,half,elapsed_seconds,event_type,event_group,shot_goal,shot_direction,shot_aim,shot_position,substitution_player_in
```

## Row types

`format_version` is exactly `arcazzi-game-v1` on every row.
`record_type` is `match`, `player`, or `event`.

### `match` (exactly one)

| column | value |
| --- | --- |
| `match_external_id` | required correlation ID; repeated on every event row; never used as a database ID |
| `match_started_at` | ISO 8601 with offset or `Z`, e.g. `2026-03-01T18:30:00Z`. Impossible calendar dates (e.g. `2026-02-30`) are rejected. |
| `tracked_team` | required label snapshot of your team |
| `opponent` | optional label |

All player/event columns must be empty.

### `player` (one per roster member, 1–100)

`player_number` (unique non-negative integer) and `player_name` are required;
all other data columns must be empty. Players with zero events are preserved.

### `event` (0–4,000)

| column | value |
| --- | --- |
| `event_sequence` | unique non-negative integer; defines order within the match and is persisted so equal-timestamp events keep that order on history/export |
| `player_number` | must exist in the roster |
| `half` | `firstHalf` or `secondHalf` |
| `elapsed_seconds` | integer ≥ 0 (overtime within a half is allowed) |
| `event_type` | `shot`, `provoked7meter`, `provoked2min`, `travelling`, `dribbleFault`, `forcing`, `lostBall`, `interception`, `sevenMeterConceded`, `oneOnOneLost`, `blockedShot`, `offensiveFoul`, `redCard`, `yellowCard`, `twoMinuteSuspension`, `substitution`, `startingPlayer` |
| `event_group` | `attack`, `defense`, `sanction`, or `substitution`, matching the event type |
| `shot_goal` | `true`/`false`; shots only (blank is not `false`) |
| `shot_direction` | `OnTarget`, `OffTarget`, `Blocked`, `Post`; shots only |
| `shot_aim` | `TopLeft`…`BottomRight`; only for `OnTarget` shots, optional |
| `shot_position` | `9m+`, `6m+`, `penetration`, `rightWing`, `leftWing`, `pivot`, `other`; shots only |
| `substitution_player_in` | roster player number; substitutions only |

Shot-only columns must be empty on non-shots; `substitution_player_in` must be
empty except on substitutions.

### Cross-row rules

- One match identity: every event repeats the match row's `match_external_id`.
- Unique roster numbers and event sequences.
- Elapsed seconds must not decrease within a half (in sequence order); all
  first-half sequences precede second-half sequences.
- Off-target/post shots cannot be goals; `shot_aim` requires `OnTarget`.
- Substitution in/out players must differ and be on the roster.
- At most 7 distinct `startingPlayer` rows per half, all at elapsed 0. With a
  complete 7-player lineup, substitutions are replayed against court state;
  with an incomplete lineup a warning is emitted instead.

## Legacy compatibility (`legacy-event-log-v0`)

The previous unversioned event-log export (headers `player,ellapsedSeconds,eventType,eventGroup,half,shotGoal,shotDirection,shotAim,shotPosition,substitutionPlayerIn`)
is still importable. Because it lacks match metadata, the import flow asks for
your tracked team and the match date (opponent optional). Player numbers are
resolved against that team's current roster; unknown numbers are errors. The
match timestamp is stored as noon UTC (`YYYY-MM-DDT12:00:00.000Z`) so the date
cannot shift across time zones.

## Import behavior

- Preview validates everything and writes nothing. Errors report row, column,
  the supplied value (truncated), and a fix-it message.
- Confirm re-validates the uploaded file, verifies the preview fingerprint,
  and writes the game (source `imported`, never the active game), roster
  snapshot, events, and import provenance in one atomic batch.
- A SHA-256 fingerprint of the canonical (not raw) data blocks exact duplicate
  imports per account; a same team/date/opponent match with different content
  is a "likely duplicate" that requires an explicit acknowledgement.

## Versioning policy

Future versions will use a new `format_version` value with their own parser
and serializer. `arcazzi-game-v1` files will never be silently reinterpreted.
