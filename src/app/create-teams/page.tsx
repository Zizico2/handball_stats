import { CreateTeamsClient } from "@/components/create-teams/CreateTeamsClient";

// TODO: remove client wrapper once TanStack DB supports SSR
export default function CreateTeamsPage() {
  return <CreateTeamsClient />;
}
