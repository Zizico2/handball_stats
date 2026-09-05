import { auth } from "@clerk/nextjs/server";
import { HydrationBoundary } from "@tanstack/react-db";
import {
  activeGameLiveQuery,
  gamesLiveQuery,
  pauseTogglesLiveQuery,
  playerEventsLiveQuery,
  quickSubPairsLiveQuery,
  teamPlayersLiveQuery,
  teamsLiveQuery,
} from "@/collections";
import ActiveGame from "@/components/active-game/ActiveGame";
import { preloadDbState } from "@/server/tanstackDb";

export default async function ActiveGamePage() {
  const { userId } = await auth();
  if (!userId) {
    return null;
  }

  const state = await preloadDbState(userId, [
    playerEventsLiveQuery,
    gamesLiveQuery,
    activeGameLiveQuery,
    teamsLiveQuery,
    teamPlayersLiveQuery,
    quickSubPairsLiveQuery,
    pauseTogglesLiveQuery,
  ]);

  return (
    <HydrationBoundary state={state}>
      <ActiveGame initialNowMs={Date.now()} />
    </HydrationBoundary>
  );
}
