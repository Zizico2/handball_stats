"use client";

import { I18nProvider } from "@heroui/react";
import { QueryClient } from "@tanstack/query-core";
import { DbClient, DbProvider } from "@tanstack/react-db";
import { ThemeProvider } from "next-themes";
import { type ReactNode, useState } from "react";

export function Providers({ children }: { children: ReactNode }) {
  const [dbClient] = useState(
    () => new DbClient({ queryClient: new QueryClient() }),
  );

  return (
    <DbProvider client={dbClient}>
      <ThemeProvider
        attribute="class"
        defaultTheme="dark"
        enableSystem={false}
        disableTransitionOnChange
      >
        <I18nProvider locale="en-US">{children}</I18nProvider>
      </ThemeProvider>
    </DbProvider>
  );
}
