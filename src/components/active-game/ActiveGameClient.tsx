"use client";

import { clientOnly } from "@/components/ui/ClientOnly";

// TODO: waiting for https://github.com/TanStack/db/issues/545
// TODO: TanstackDB doesn't support SSR yet
// remove dynamic import and ssr: false once it does
export const ActiveGameClient = clientOnly(
  () => import("@/components/active-game/ActiveGame"),
);
