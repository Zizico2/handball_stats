import { Suspense } from "react";
import {
  PastGameDetailContent,
  PastGameDetailShell,
} from "@/components/PastGameDetail";
import {
  PastGameDetailHeaderSkeleton,
  PastGameEventLogSkeleton,
} from "@/components/PastGamesSkeletons";

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

export default function PastGameDetailPage({
  params,
}: PastGameDetailPageProps) {
  return (
    <div className="px-4 py-6 sm:px-6">
      <div className="flex max-w-[900px] flex-col gap-4">
        <PastGameDetailShell />
        <Suspense fallback={<PastGameDetailFallback />}>
          <PastGameDetailContent params={params} />
        </Suspense>
      </div>
    </div>
  );
}
