/**
 * Shared RFC 4180 CSV serializer with spreadsheet formula hardening.
 *
 * Cells whose text begins (after optional leading whitespace) with `=`, `+`,
 * `-`, `@`, a tab, or a carriage return are neutralized with a leading
 * single quote for CSV output only; stored values are never mutated.
 */

const FORMULA_LEADING = /^[\s\u00a0]*[=+\-@\t\r]/;

export function hardenCsvCellText(text: string): string {
  if (FORMULA_LEADING.test(text)) {
    return `'${text}`;
  }
  return text;
}

export function toCsvCell(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  const text = hardenCsvCellText(String(value));

  if (/[",\n\r]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }

  return text;
}

export function serializeCsvRows(
  rows: ReadonlyArray<readonly unknown[]>,
): string {
  return `${rows.map((row) => row.map(toCsvCell).join(",")).join("\n")}\n`;
}
