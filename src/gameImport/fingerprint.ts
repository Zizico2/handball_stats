import type { CanonicalGameImport } from "./types";

/**
 * Computes a stable SHA-256 hex fingerprint from validated canonical data
 * (never raw bytes), so BOM/line-ending/quoting/header-cosmetic variants of
 * the same game produce the same fingerprint. The format version is
 * intentionally excluded so a legacy file resolved to the same canonical
 * game as a v1 file is detected as the same import.
 */
export async function fingerprintCanonicalImport(
  canonical: CanonicalGameImport,
): Promise<string> {
  const payload = {
    matchExternalId: canonical.matchExternalId,
    matchStartedAt: canonical.matchStartedAt,
    trackedTeamName: canonical.trackedTeamName,
    opponentName: canonical.opponentName,
    roster: [...canonical.roster]
      .sort((a, b) => a.number - b.number)
      .map((player) => ({ number: player.number, name: player.name })),
    events: [...canonical.events]
      .sort((a, b) => a.sequence - b.sequence)
      .map(({ sequence, event }) => ({
        sequence,
        player: event.player,
        half: event.half,
        ellapsedSeconds: event.ellapsed_seconds,
        eventType: event.eventType,
        eventGroup: event.eventGroup,
        shot:
          event.eventType === "shot"
            ? {
                goal: event.event.goal,
                direction: event.event.direction,
                aim: event.event.aim ?? null,
                position: event.event.position,
              }
            : null,
        substitutionPlayerIn:
          event.eventType === "substitution" ? event.event.playerIn : null,
      })),
  };

  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  const digest = await crypto.subtle.digest("SHA-256", bytes);

  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
