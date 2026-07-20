"use client";

import { clientOnly } from "@/components/ui/ClientOnly";

export const HomeClient = clientOnly(() => import("@/components/home/HomeHub"));
