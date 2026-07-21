import { describe, expect, test } from "bun:test";
import { DetailedError } from "hono/client";
import { classifyTeamHasGamesConflict } from "@/server/api/teamDeletionErrors";

function responseError(statusCode: number, data: unknown) {
  return new DetailedError(`${statusCode} response`, {
    statusCode,
    detail: { data },
  });
}

describe("classifyTeamHasGamesConflict", () => {
  test("classifies the structured 409 response", () => {
    expect(
      classifyTeamHasGamesConflict(
        responseError(409, {
          code: "TEAM_HAS_GAMES",
          teamIds: [2, 5],
        }),
      ),
    ).toEqual({ code: "TEAM_HAS_GAMES", teamIds: [2, 5] });
  });

  test("rejects generic and malformed conflicts", () => {
    expect(
      classifyTeamHasGamesConflict(
        responseError(409, { message: "Team has games" }),
      ),
    ).toBeNull();
    expect(
      classifyTeamHasGamesConflict(
        responseError(409, {
          code: "TEAM_HAS_GAMES",
          teamIds: [5, 2],
        }),
      ),
    ).toBeNull();
    expect(
      classifyTeamHasGamesConflict(
        responseError(500, {
          code: "TEAM_HAS_GAMES",
          teamIds: [2, 5],
        }),
      ),
    ).toBeNull();
  });
});
