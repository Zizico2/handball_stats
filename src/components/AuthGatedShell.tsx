import { Show } from "@clerk/nextjs";
import { connection } from "next/server";
import { Suspense } from "react";
import AppShellSkeleton from "@/components/AppShellSkeleton";
import ResponsiveDrawer from "@/components/ResponsiveDrawer";
import SignedOutEntry from "@/components/SignedOutEntry";

async function AuthenticatedApp({
  children,
  trailingActions,
}: {
  children: React.ReactNode;
  trailingActions: React.ReactNode;
}) {
  await connection();

  return (
    <>
      <Show when="signed-in">
        <div className="flex h-dvh w-dvw flex-col overflow-hidden">
          <ResponsiveDrawer trailingActions={trailingActions}>
            {children}
          </ResponsiveDrawer>
        </div>
      </Show>
      <Show when="signed-out">
        <SignedOutEntry />
      </Show>
    </>
  );
}

export default function AuthGatedShell({
  children,
  trailingActions,
}: {
  children: React.ReactNode;
  trailingActions: React.ReactNode;
}) {
  return (
    <Suspense fallback={<AppShellSkeleton />}>
      <AuthenticatedApp trailingActions={trailingActions}>
        {children}
      </AuthenticatedApp>
    </Suspense>
  );
}
