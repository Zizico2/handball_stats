import { ActiveGameClient } from "@/components/active-game/ActiveGameClient";

// TODO: remove client wrapper once TanStack DB supports SSR
export default function ActiveGamePage() {
  return <ActiveGameClient />;
}
