export function formatGameDate(
  value: string,
  dateStyle: "medium" | "full" = "medium",
) {
  return new Intl.DateTimeFormat("en", {
    dateStyle,
    timeStyle: "short",
  }).format(new Date(value));
}
