import { auth } from "@clerk/nextjs/server";
import { HydrationBoundary } from "@tanstack/react-db";
import { Suspense } from "react";
import {
  activeGameLiveQuery,
  teamPlayersLiveQuery,
  teamsLiveQuery,
} from "@/collections";
import { NewGamePageSkeleton } from "@/components/GameRouteSkeletons";
import NewGame from "@/components/new-game/NewGame";
import { preloadDbState } from "@/server/tanstackDb";

export default async function NewGamePage() {
  const { userId } = await auth();
  if (!userId) {
    return null;
  }

  const state = await preloadDbState(userId, [
    teamsLiveQuery,
    teamPlayersLiveQuery,
    activeGameLiveQuery,
  ]);

  return (
    <HydrationBoundary state={state}>
      <Suspense fallback={<NewGamePageSkeleton />}>
        <NewGame />
      </Suspense>
    </HydrationBoundary>
  );
}
