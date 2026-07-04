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

const navItemClassName =
  "flex w-full items-center rounded-xl px-3 py-2.5 text-sm text-foreground no-underline transition-colors hover:bg-default";

export function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-1 p-2">
      {navItems.map((item) => (
        <NextLink
          key={item.href}
          className={navItemClassName}
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
