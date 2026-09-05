import { auth } from "@clerk/nextjs/server";
import { HydrationBoundary } from "@tanstack/react-db";
import {
  activeGameLiveQuery,
  gamesLiveQuery,
  pauseTogglesLiveQuery,
  teamPlayersLiveQuery,
  teamsLiveQuery,
} from "@/collections";
import HomeHub from "@/components/home/HomeHub";
import { preloadDbState } from "@/server/tanstackDb";

export default async function Home() {
  const { userId } = await auth();
  if (!userId) {
    return null;
  }

  const state = await preloadDbState(userId, [
    teamsLiveQuery,
    teamPlayersLiveQuery,
    gamesLiveQuery,
    activeGameLiveQuery,
    pauseTogglesLiveQuery,
  ]);

  return (
    <HydrationBoundary state={state}>
      <HomeHub initialNowMs={Date.now()} />
    </HydrationBoundary>
  );
}
