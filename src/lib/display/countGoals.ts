import type { PlayerEvent } from "@/datamodel";

export interface MatchScore {
  teamScore: number;
  opponentScore: number;
}

export function countScores(events: PlayerEvent[]): MatchScore {
  return events.reduce<MatchScore>(
    (score, event) => {
      if (
        (event.eventType !== "shot" && event.eventType !== "sevenMeterTaken") ||
        !event.event.goal
      ) {
        return score;
      }

      if (event.eventGroup === "defense") {
        score.opponentScore += 1;
      } else {
        score.teamScore += 1;
      }
      return score;
    },
    { teamScore: 0, opponentScore: 0 },
  );
}

export function countGoals(events: PlayerEvent[]): number {
  return countScores(events).teamScore;
}
