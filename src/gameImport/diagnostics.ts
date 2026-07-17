import {
  IMPORT_MAX_DIAGNOSTIC_VALUE_CODE_POINTS,
  IMPORT_MAX_ERRORS,
} from "./csvContract";
import type { ImportDiagnostic, ImportDiagnosticSeverity } from "./types";

export function truncateDiagnosticValue(value: string): string {
  const codePoints = [...value];
  if (codePoints.length <= IMPORT_MAX_DIAGNOSTIC_VALUE_CODE_POINTS) {
    return value;
  }
  return codePoints.slice(0, IMPORT_MAX_DIAGNOSTIC_VALUE_CODE_POINTS).join("");
}

export function makeDiagnostic(input: {
  code: string;
  severity?: ImportDiagnosticSeverity;
  row?: number | null;
  column?: string | null;
  value?: string | null;
  message: string;
}): ImportDiagnostic {
  return {
    code: input.code,
    severity: input.severity ?? "error",
    row: input.row ?? null,
    column: input.column ?? null,
    value:
      input.value === null || input.value === undefined
        ? null
        : truncateDiagnosticValue(input.value),
    message: input.message,
  };
}

/**
 * Collects diagnostics up to `IMPORT_MAX_ERRORS` errors; once the cap is hit
 * a single `TOO_MANY_ERRORS` diagnostic is appended and further errors are
 * dropped. Warnings are always retained.
 */
export class DiagnosticCollector {
  readonly diagnostics: ImportDiagnostic[] = [];
  private errorCount = 0;
  private capped = false;

  add(input: Parameters<typeof makeDiagnostic>[0]): void {
    const diagnostic = makeDiagnostic(input);

    if (diagnostic.severity === "warning") {
      this.diagnostics.push(diagnostic);
      return;
    }

    if (this.capped) {
      return;
    }

    if (this.errorCount >= IMPORT_MAX_ERRORS) {
      this.capped = true;
      this.diagnostics.push(
        makeDiagnostic({
          code: "TOO_MANY_ERRORS",
          message: `More than ${IMPORT_MAX_ERRORS} errors were found; fix the reported issues and try again.`,
        }),
      );
      return;
    }

    this.errorCount += 1;
    this.diagnostics.push(diagnostic);
  }

  get hasErrors(): boolean {
    return this.errorCount > 0 || this.capped;
  }

  get errors(): ImportDiagnostic[] {
    return this.diagnostics.filter((d) => d.severity === "error");
  }

  get warnings(): ImportDiagnostic[] {
    return this.diagnostics.filter((d) => d.severity === "warning");
  }
}
