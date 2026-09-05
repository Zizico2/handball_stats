"use client";

import { useDbClient } from "@tanstack/react-db";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { materializeCollections } from "@/collections";
import { navItems } from "@/components/ResponsiveDrawer/NavLinks";

/**
 * Warm the authenticated app's route cache even when the mobile drawer is
 * closed and its links are outside the viewport.
 */
export function RoutePrefetcher() {
  const router = useRouter();
  const dbClient = useDbClient();

  useEffect(() => {
    for (const item of navItems) {
      router.prefetch(item.href);
    }
  }, [router]);

  useEffect(() => {
    const collections = materializeCollections(dbClient);
    void Promise.all(
      Object.values(collections).map((collection) => collection.preload()),
    );
  }, [dbClient]);

  return null;
}
