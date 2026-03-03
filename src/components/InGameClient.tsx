// TODO: only keep this for testing, while InGame.tsx is using localStorageCollection, which is not SSR compatible.
// Once we have a proper collection setup, we can remove this and use InGame.tsx directly in the page.

"use client";
import dynamic from "next/dynamic";

const InGame = dynamic(() => import("./InGame"), { ssr: false });

export default function InGameClient() {
  return <InGame />;
}
