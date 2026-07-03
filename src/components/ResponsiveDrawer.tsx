"use client";

import { Show, UserButton } from "@clerk/nextjs";
import {
  Button,
  Drawer,
  ScrollShadow,
  Separator,
  Surface,
  Toolbar,
  Typography,
} from "@heroui/react";
import { Menu } from "lucide-react";
import NextLink from "next/link";
import type * as React from "react";
import { useState } from "react";

const navItems = [
  { text: "Home", href: "/" },
  { text: "New Game", href: "/new-game" },
  { text: "Active Game", href: "/active-game" },
  { text: "Past Games", href: "/past-games" },
  { text: "Create Teams", href: "/create-teams" },
];

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-1 p-2">
      {navItems.map((item) => (
        <NextLink
          key={item.href}
          className="link rounded-lg px-3 py-2 text-foreground no-underline hover:bg-surface-secondary"
          href={item.href}
          onClick={onNavigate}
        >
          {item.text}
        </NextLink>
      ))}
      <Show when="signed-in">
        <div className="px-2 pt-2">
          <UserButton showName />
        </div>
      </Show>
    </nav>
  );
}

export default function ResponsiveDrawer({
  children,
  trailingActions,
}: {
  children: React.ReactNode;
  trailingActions?: React.ReactNode;
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

      <Drawer>
        <Drawer.Backdrop isOpen={mobileOpen} onOpenChange={setMobileOpen}>
          <Drawer.Content className="w-60 sm:hidden" placement="left">
            <Drawer.Header>
              <Drawer.Heading>Arcazzi</Drawer.Heading>
            </Drawer.Header>
            <Drawer.Body>
              <NavLinks onNavigate={() => setMobileOpen(false)} />
            </Drawer.Body>
          </Drawer.Content>
        </Drawer.Backdrop>
      </Drawer>

      <div className="flex w-full flex-col">
        <Surface
          className="shrink-0 border-b border-separator"
          variant="default"
        >
          <Toolbar className="flex min-h-14 items-center gap-2 px-2">
            <Button
              isIconOnly
              aria-label="Open navigation"
              className="sm:hidden"
              variant="ghost"
              onPress={() => setMobileOpen(true)}
            >
              <Menu className="size-5" />
            </Button>
            <Typography.Heading level={4} className="flex-1 truncate">
              Arcazzi
            </Typography.Heading>
            {trailingActions}
          </Toolbar>
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
