import { NewGameClient } from "@/components/new-game/NewGameClient";

// TODO: remove client wrapper once TanStack DB supports SSR
export default function NewGamePage() {
  return <NewGameClient />;
}
