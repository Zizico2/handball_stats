import { parse } from "csv-parse/browser/esm/sync";

/**
 * Thin Workers-compatible wrapper around the CSV parsing library so the
 * dependency does not leak through the app. Parses RFC 4180 CSV text into
 * raw string cell rows (header included), preserving 1-based physical line
 * numbers for diagnostics.
 */

export type RawCsvRow = {
  /** 1-based physical CSV line the record started on. */
  line: number;
  cells: string[];
};

export type ParseCsvResult =
  | { ok: true; rows: RawCsvRow[] }
  | { ok: false; line: number | null; message: string };

export function parseCsvText(text: string): ParseCsvResult {
  let records: { cells: string[]; line: number }[];

  try {
    const parsed = parse(text, {
      bom: true,
      relax_column_count: true,
      skip_empty_lines: true,
      trim: false,
      info: true,
    }) as Array<{
      record: string[];
      info: { lines: number };
    }>;

    records = parsed.map((entry) => ({
      cells: entry.record,
      line: entry.info.lines,
    }));
  } catch (error) {
    const line =
      error && typeof error === "object" && "lines" in error
        ? Number((error as { lines: unknown }).lines) || null
        : null;
    return {
      ok: false,
      line,
      message: "The file is not valid CSV (check quoting and delimiters).",
    };
  }

  return {
    ok: true,
    rows: records.map((record) => ({
      line: record.line,
      cells: record.cells,
    })),
  };
}
