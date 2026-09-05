import { auth } from "@clerk/nextjs/server";
import { HydrationBoundary } from "@tanstack/react-db";
import { Suspense } from "react";
import {
  quickSubPairsLiveQuery,
  teamPlayersLiveQuery,
  teamsLiveQuery,
} from "@/collections";
import CreateTeams from "@/components/create-teams/CreateTeams";
import { CreateTeamsPageSkeleton } from "@/components/GameRouteSkeletons";
import { preloadDbState } from "@/server/tanstackDb";

export default async function CreateTeamsPage() {
  const { userId } = await auth();
  if (!userId) {
    return null;
  }

  const state = await preloadDbState(userId, [
    teamsLiveQuery,
    teamPlayersLiveQuery,
    quickSubPairsLiveQuery,
  ]);

  return (
    <HydrationBoundary state={state}>
      <Suspense fallback={<CreateTeamsPageSkeleton />}>
        <CreateTeams />
      </Suspense>
    </HydrationBoundary>
  );
}
