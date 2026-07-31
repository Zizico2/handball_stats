import { describe, expect, test } from "bun:test";
import { DetailedError } from "hono/client";
import { isTeamHasGamesConflict } from "@/server/api/teamDeletionErrors";

function responseError(statusCode: number, data: unknown) {
  return new DetailedError(`${statusCode} response`, {
    statusCode,
    detail: { data },
  });
}

describe("isTeamHasGamesConflict", () => {
  test("classifies the structured 409 response", () => {
    expect(
      isTeamHasGamesConflict(
        responseError(409, {
          code: "TEAM_HAS_GAMES",
          teamIds: [2, 5],
        }),
      ),
    ).toBe(true);
  });

  test("rejects generic and malformed conflicts", () => {
    expect(
      isTeamHasGamesConflict(responseError(409, { message: "Team has games" })),
    ).toBe(false);
    expect(
      isTeamHasGamesConflict(
        responseError(500, {
          code: "TEAM_HAS_GAMES",
          teamIds: [2, 5],
        }),
      ),
    ).toBe(false);
  });
});
