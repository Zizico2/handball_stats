"use client";

import { Show, UserButton } from "@clerk/nextjs";
import NextLink from "next/link";

export const navItems = [
  { text: "Home", href: "/" },
  { text: "New Game", href: "/new-game" },
  { text: "Active Game", href: "/active-game" },
  { text: "Past Games", href: "/past-games" },
  { text: "Create Teams", href: "/create-teams" },
];

export function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
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
