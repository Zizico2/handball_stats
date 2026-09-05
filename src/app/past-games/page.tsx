import { auth } from "@clerk/nextjs/server";
import { HydrationBoundary } from "@tanstack/react-db";
import { Suspense } from "react";
import {
  activeGameLiveQuery,
  gamesLiveQuery,
  playerEventsLiveQuery,
  teamsLiveQuery,
} from "@/collections";
import { PastGamesList } from "@/components/PastGamesList";
import {
  PastGamesHeader,
  PastGamesListSkeleton,
} from "@/components/PastGamesSkeletons";
import { preloadDbState } from "@/server/tanstackDb";

export default async function PastGamesPage() {
  const { userId } = await auth();
  if (!userId) return null;

  const state = await preloadDbState(userId, [
    gamesLiveQuery,
    teamsLiveQuery,
    playerEventsLiveQuery,
    activeGameLiveQuery,
  ]);

  return (
    <div className="px-4 py-6 sm:px-6">
      <PastGamesHeader />
      <HydrationBoundary state={state}>
        <Suspense fallback={<PastGamesListSkeleton />}>
          <PastGamesList />
        </Suspense>
      </HydrationBoundary>
    </div>
  );
}
