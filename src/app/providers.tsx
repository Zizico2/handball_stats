"use client";

import { I18nProvider } from "@heroui/react";
import { ThemeProvider } from "next-themes";
import type { ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem={false}
      disableTransitionOnChange
    >
      <I18nProvider locale="en-US">{children}</I18nProvider>
    </ThemeProvider>
  );
}
