import { IMPORT_MAX_FILENAME_CODE_POINTS } from "./csvContract";

/**
 * Reduces a client-supplied filename to a safe basename: strips Unix and
 * Windows path segments, control characters, and truncates to the documented
 * limit. Never returns an empty or path-bearing value.
 */
export function sanitizeFilename(input: string): string {
  const segments = input.split(/[/\\]/);
  const basename = segments[segments.length - 1] ?? "";

  // biome-ignore lint/suspicious/noControlCharactersInRegex: intentional control-character stripping
  const cleaned = basename.replaceAll(/[\u0000-\u001f\u007f]/g, "").trim();

  if (cleaned === "" || cleaned === "." || cleaned === "..") {
    return "import.csv";
  }

  const codePoints = [...cleaned];
  if (codePoints.length <= IMPORT_MAX_FILENAME_CODE_POINTS) {
    return cleaned;
  }

  return codePoints.slice(0, IMPORT_MAX_FILENAME_CODE_POINTS).join("");
}
