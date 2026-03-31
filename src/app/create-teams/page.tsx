"use client";
import dynamic from "next/dynamic";

// TODO: waiting for https://github.com/TanStack/db/issues/545
// TODO: TanstackDB doesn't support SSR yet
// remove dynamic import and ssr: false once it does
// remove "use client" directive once SSR is supported
const NoSSRCreateTeams = dynamic(() => import("../../components/CreateTeams"), {
  ssr: false,
});

export default function CreateTeamsPage() {
  return <NoSSRCreateTeams />;
}
