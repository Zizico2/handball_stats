"use client";

import {
  Button,
  ScrollShadow,
  Separator,
  Surface,
  Typography,
} from "@heroui/react";
import { Menu } from "lucide-react";
import type * as React from "react";
import { useState } from "react";
import { MatchSyncStatus } from "@/components/MatchSyncStatus";
import { MobileNavDrawer } from "@/components/ResponsiveDrawer/MobileNavDrawer";
import { NavLinks } from "@/components/ResponsiveDrawer/NavLinks";

export default function ResponsiveDrawer({
  children,
  trailingActions,
}: {
  children: React.ReactNode;
  trailingActions: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-full w-full flex-row">
      <Surface
        aria-label="Navigation"
        className="hidden h-full w-60 shrink-0 border-r border-separator sm:block"
        variant="default"
      >
        <div className="h-14" />
        <Separator />
        <NavLinks />
      </Surface>

      <MobileNavDrawer isOpen={mobileOpen} onOpenChange={setMobileOpen} />

      <div className="flex w-full flex-col">
        <Surface
          className="shrink-0 border-b border-separator"
          variant="default"
        >
          <div className="flex w-full min-h-14 items-center gap-2 px-2">
            <Button
              isIconOnly
              aria-label="Open navigation"
              className="shrink-0 sm:hidden"
              variant="ghost"
              onPress={() => setMobileOpen(true)}
            >
              <Menu className="size-5" />
            </Button>
            <Typography.Heading level={4} className="min-w-0 flex-1 truncate">
              Arcazzi
            </Typography.Heading>
            <div className="ml-auto flex shrink-0 items-center gap-2">
              <MatchSyncStatus />
              {trailingActions}
            </div>
          </div>
        </Surface>

        <main className="flex min-h-0 flex-1 flex-col">
          <ScrollShadow
            className="flex min-h-0 flex-1 flex-col"
            orientation="vertical"
          >
            {children}
          </ScrollShadow>
        </main>
      </div>
    </div>
  );
}
