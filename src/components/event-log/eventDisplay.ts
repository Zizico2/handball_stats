import type { MatchHalf } from "@/datamodel";

type ChipColor = "default" | "accent" | "success" | "warning" | "danger";

export function getEventGroupColor(group: string): ChipColor {
  switch (group) {
    case "attack":
      return "warning";
    case "defense":
      return "accent";
    case "sanction":
      return "danger";
    case "substitution":
      return "success";
    default:
      return "default";
  }
}

export function formatHalfLabel(half: MatchHalf): string {
  return half === "firstHalf" ? "1st Half" : "2nd Half";
}
