import { describe, expect, test } from "bun:test";
import { isStrictCalendarDate, parseStrictIsoTimestamp } from "./calendarDate";

describe("parseStrictIsoTimestamp", () => {
  test("accepts real calendar timestamps and returns UTC ISO", () => {
    expect(parseStrictIsoTimestamp("2026-03-01T18:30:00Z")).toBe(
      "2026-03-01T18:30:00.000Z",
    );
    expect(parseStrictIsoTimestamp("2026-03-01T18:30:00+01:00")).toBe(
      "2026-03-01T17:30:00.000Z",
    );
  });

  test("rejects calendar-impossible dates that Date.parse would normalize", () => {
    expect(parseStrictIsoTimestamp("2026-02-30T12:00:00Z")).toBeNull();
    expect(parseStrictIsoTimestamp("2026-04-31T00:00:00Z")).toBeNull();
    expect(parseStrictIsoTimestamp("2026-13-01T00:00:00Z")).toBeNull();
  });

  test("rejects malformed timestamps", () => {
    expect(parseStrictIsoTimestamp("2026-03-01 18:30")).toBeNull();
    expect(parseStrictIsoTimestamp("not-a-date")).toBeNull();
  });
});

describe("isStrictCalendarDate", () => {
  test("accepts real Gregorian dates", () => {
    expect(isStrictCalendarDate("2026-03-01")).toBe(true);
    expect(isStrictCalendarDate("2024-02-29")).toBe(true);
  });

  test("rejects impossible calendar dates", () => {
    expect(isStrictCalendarDate("2026-02-30")).toBe(false);
    expect(isStrictCalendarDate("2026-04-31")).toBe(false);
    expect(isStrictCalendarDate("2025-02-29")).toBe(false);
    expect(isStrictCalendarDate("2026-3-01")).toBe(false);
  });
});
