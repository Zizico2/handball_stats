import { describe, expect, test } from "bun:test";
import { allocateLocalId, allocateLocalIds } from "./allocateLocalId";

describe("allocateLocalIds", () => {
  test("returns the requested number of unique positive safe integers", () => {
    const ids = allocateLocalIds(1000);
    expect(ids).toHaveLength(1000);
    expect(new Set(ids).size).toBe(1000);
    for (const id of ids) {
      expect(Number.isSafeInteger(id)).toBe(true);
      expect(id).toBeGreaterThanOrEqual(1);
      expect(id).toBeLessThanOrEqual(Number.MAX_SAFE_INTEGER);
    }
  });

  test("returns an empty array for zero", () => {
    expect(allocateLocalIds(0)).toEqual([]);
  });

  test("rejects invalid counts", () => {
    expect(() => allocateLocalIds(-1)).toThrow();
    expect(() => allocateLocalIds(1.5)).toThrow();
  });

  test("allocateLocalId returns one id", () => {
    expect(Number.isSafeInteger(allocateLocalId())).toBe(true);
  });
});
