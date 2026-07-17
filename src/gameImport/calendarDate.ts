/**
 * Strict calendar validation for import timestamps/dates.
 *
 * `Date.parse` normalizes impossible calendar values (e.g. 2026-02-30 → Mar 2).
 * These helpers reject inputs whose written Y-M-D (and time) components do not
 * round-trip through the Date UTC getters.
 */

const ISO_WITH_OFFSET =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(Z|[+-]\d{2}:\d{2})$/;

const LEGACY_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

function matchesUtcComponents(
  probe: Date,
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
): boolean {
  return (
    probe.getUTCFullYear() === year &&
    probe.getUTCMonth() === month - 1 &&
    probe.getUTCDate() === day &&
    probe.getUTCHours() === hour &&
    probe.getUTCMinutes() === minute &&
    probe.getUTCSeconds() === second
  );
}

/**
 * Returns the canonical UTC ISO string when `raw` is a valid ISO-8601
 * timestamp with offset/Z whose calendar components are real; otherwise null.
 */
export function parseStrictIsoTimestamp(raw: string): string | null {
  const match = ISO_WITH_OFFSET.exec(raw);
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6] ?? "0");

  // Validate the written wall-clock components as a calendar (treat as UTC
  // numbers so Feb 30 is rejected regardless of offset).
  const calendarProbe = new Date(
    Date.UTC(year, month - 1, day, hour, minute, second),
  );
  if (
    !matchesUtcComponents(calendarProbe, year, month, day, hour, minute, second)
  ) {
    return null;
  }

  const instant = Date.parse(raw);
  if (Number.isNaN(instant)) {
    return null;
  }

  return new Date(instant).toISOString();
}

/** True when `raw` is a real Gregorian YYYY-MM-DD date. */
export function isStrictCalendarDate(raw: string): boolean {
  const match = LEGACY_DATE.exec(raw);
  if (!match) {
    return false;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const probe = new Date(Date.UTC(year, month - 1, day));
  return (
    probe.getUTCFullYear() === year &&
    probe.getUTCMonth() === month - 1 &&
    probe.getUTCDate() === day
  );
}
