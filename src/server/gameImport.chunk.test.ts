import { describe, expect, test } from "bun:test";
import {
  chunkRows,
  D1_MAX_BOUND_PARAMETERS,
  maxRowsPerInsert,
  PLAYER_EVENT_INSERT_COLUMN_COUNT,
  ROSTER_SNAPSHOT_INSERT_COLUMN_COUNT,
} from "@/server/gameImport";

describe("D1 insert chunking", () => {
  test("keeps each chunk within the 100-parameter binding limit", () => {
    expect(D1_MAX_BOUND_PARAMETERS).toBe(100);
    expect(maxRowsPerInsert(PLAYER_EVENT_INSERT_COLUMN_COUNT)).toBe(7);
    expect(maxRowsPerInsert(ROSTER_SNAPSHOT_INSERT_COLUMN_COUNT)).toBe(20);

    const events = Array.from({ length: 8 }, (_, index) => index);
    const eventChunks = chunkRows(events, PLAYER_EVENT_INSERT_COLUMN_COUNT);
    expect(eventChunks).toEqual([[0, 1, 2, 3, 4, 5, 6], [7]]);
    for (const chunk of eventChunks) {
      expect(
        chunk.length * PLAYER_EVENT_INSERT_COLUMN_COUNT,
      ).toBeLessThanOrEqual(D1_MAX_BOUND_PARAMETERS);
    }

    const roster = Array.from({ length: 21 }, (_, index) => index);
    const rosterChunks = chunkRows(roster, ROSTER_SNAPSHOT_INSERT_COLUMN_COUNT);
    expect(rosterChunks).toHaveLength(2);
    expect(rosterChunks[0]).toHaveLength(20);
    expect(rosterChunks[1]).toHaveLength(1);
  });
});
