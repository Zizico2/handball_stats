import { auth } from "@clerk/nextjs/server";
import { HydrationBoundary } from "@tanstack/react-db";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import {
  PastGameDetailContent,
  PastGameDetailShell,
} from "@/components/PastGameDetail";
import {
  PastGameDetailHeaderSkeleton,
  PastGameEventLogSkeleton,
} from "@/components/PastGamesSkeletons";
import { clientIdSchema } from "@/datamodel";
import { preloadPastGameDbState } from "@/server/tanstackDb";

interface PastGameDetailPageProps {
  params: Promise<{
    gameId: string;
  }>;
}

function PastGameDetailFallback() {
  return (
    <>
      <PastGameDetailHeaderSkeleton />
      <PastGameEventLogSkeleton />
    </>
  );
}

export default async function PastGameDetailPage({
  params,
}: PastGameDetailPageProps) {
  const { userId } = await auth();
  if (!userId) return null;

  const resolvedParams = await params;
  const parsedGameId = clientIdSchema.safeParse(resolvedParams.gameId);
  if (!parsedGameId.success) notFound();

  const gameId = parsedGameId.data;
  const state = await preloadPastGameDbState(userId, gameId);
  if (!state) notFound();

  return (
    <div className="px-4 py-6 sm:px-6">
      <div className="flex max-w-[900px] flex-col gap-4">
        <PastGameDetailShell />
        <HydrationBoundary state={state}>
          <Suspense fallback={<PastGameDetailFallback />}>
            <PastGameDetailContent gameId={gameId} />
          </Suspense>
        </HydrationBoundary>
      </div>
    </div>
  );
}
