import { Suspense } from "react";
import { PastGamesList } from "@/components/PastGamesList";
import {
  PastGamesHeader,
  PastGamesListSkeleton,
} from "@/components/PastGamesSkeletons";

export default function PastGamesPage() {
  return (
    <div className="px-4 py-6 sm:px-6">
      <PastGamesHeader />
      <Suspense fallback={<PastGamesListSkeleton />}>
        <PastGamesList />
      </Suspense>
    </div>
  );
}
