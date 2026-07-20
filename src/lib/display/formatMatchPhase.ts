import type { MatchStatus } from "@/inGameControlsAtoms";

export function formatMatchPhase(matchStatus: MatchStatus | null): string {
  switch (matchStatus) {
    case "firstHalf":
      return "First half";
    case "halftime":
      return "Halftime";
    case "secondHalf":
      return "Second half";
    default:
      return "Not started";
  }
}

export function formatClockRunningState(
  matchStatus: MatchStatus | null,
  isRunning: boolean,
): string {
  if (matchStatus === null) {
    return "Ready";
  }
  if (matchStatus === "halftime") {
    return "Break";
  }
  return isRunning ? "Running" : "Paused";
}
