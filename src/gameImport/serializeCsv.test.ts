import { describe, expect, test } from "bun:test";
import { ARCAZZI_GAME_V1 } from "./csvContract";
import { sanitizeFilename } from "./sanitizeFilename";
import { hardenCsvCellText, serializeCsvRows, toCsvCell } from "./serializeCsv";
import { serializeArcazziGameV1 } from "./serializeGameCsv";
import { inspectCsv, validateArcazziGameV1 } from "./validate";

describe("serializeCsv", () => {
  test("quotes cells with commas, quotes and newlines", () => {
    expect(toCsvCell("a,b")).toBe('"a,b"');
    expect(toCsvCell('say "hi"')).toBe('"say ""hi"""');
    expect(toCsvCell("line1\nline2")).toBe('"line1\nline2"');
    expect(toCsvCell(null)).toBe("");
    expect(toCsvCell(7)).toBe("7");
  });

  test("neutralizes spreadsheet formula-leading characters", () => {
    expect(hardenCsvCellText("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(hardenCsvCellText("+cmd")).toBe("'+cmd");
    expect(hardenCsvCellText("-2+3")).toBe("'-2+3");
    expect(hardenCsvCellText("@evil")).toBe("'@evil");
    expect(hardenCsvCellText("  =late")).toBe("'  =late");
    expect(hardenCsvCellText("safe")).toBe("safe");
  });

  test("serializeCsvRows joins rows with a trailing newline", () => {
    expect(
      serializeCsvRows([
        ["a", "b"],
        ["1", "2"],
      ]),
    ).toBe("a,b\n1,2\n");
  });
});

describe("sanitizeFilename", () => {
  test("strips paths and control characters, keeps basename", () => {
    expect(sanitizeFilename("/home/user/match.csv")).toBe("match.csv");
    expect(sanitizeFilename("C:\\Users\\me\\match.csv")).toBe("match.csv");
    expect(sanitizeFilename("ma\u0000tch\u001f.csv")).toBe("match.csv");
    expect(sanitizeFilename("..")).toBe("import.csv");
    expect(sanitizeFilename("")).toBe("import.csv");
    expect(sanitizeFilename(`${"a".repeat(300)}.csv`)).toHaveLength(255);
  });
});

describe("serializeArcazziGameV1", () => {
  test("export round-trips through the import validator", () => {
    const csv = serializeArcazziGameV1({
      matchExternalId: "game-42",
      matchStartedAt: "2026-03-01T18:30:00.000Z",
      trackedTeamName: "Arcazzi",
      opponentName: "Rivals HC",
      roster: [
        { number: 9, name: "Bruna Costa" },
        { number: 7, name: "Ana Silva" },
      ],
      events: [
        {
          player: 7,
          half: "firstHalf",
          ellapsedSeconds: 95,
          eventType: "shot",
          eventGroup: "attack",
          shotGoal: true,
          shotDirection: "OnTarget",
          shotAim: "TopLeft",
          shotPosition: "9m+",
          substitutionPlayerIn: null,
        },
        {
          player: 7,
          half: "secondHalf",
          ellapsedSeconds: 120,
          eventType: "substitution",
          eventGroup: "substitution",
          shotGoal: null,
          shotDirection: null,
          shotAim: null,
          shotPosition: null,
          substitutionPlayerIn: 9,
        },
      ],
    });

    const inspection = inspectCsv(csv);
    expect(inspection.ok).toBe(true);
    if (!inspection.ok) return;
    expect(inspection.format).toBe(ARCAZZI_GAME_V1);

    const result = validateArcazziGameV1(inspection.dataRows);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.canonical.trackedTeamName).toBe("Arcazzi");
    expect(result.canonical.roster).toEqual([
      { number: 7, name: "Ana Silva" },
      { number: 9, name: "Bruna Costa" },
    ]);
    expect(result.canonical.events).toHaveLength(2);
    expect(result.canonical.goalCount).toBe(1);
  });

  test("hardens formula-leading team names on export without mutating input", () => {
    const csv = serializeArcazziGameV1({
      matchExternalId: "game-1",
      matchStartedAt: "2026-03-01T18:30:00.000Z",
      trackedTeamName: "=EvilTeam",
      opponentName: null,
      roster: [{ number: 7, name: "Ana" }],
      events: [],
    });
    expect(csv).toContain("'=EvilTeam");
  });
});
