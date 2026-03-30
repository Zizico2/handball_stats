import "./globals.css";
import CssBaseline from "@mui/material/CssBaseline";
import { ThemeProvider } from "@mui/material/styles";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v15-appRouter";
import { Roboto } from "next/font/google";
import ResponsiveDrawer from "@/components/ResponsiveDrawer";
import {
  ClerkProvider,
  Show,
  SignInButton,
  SignUpButton,
  UserButton,
} from "@clerk/nextjs";
import theme from "../theme";

const roboto = Roboto({
  weight: ["300", "400", "500", "700"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-roboto",
});

import { Box, Button } from "@mui/material";
import InitColorSchemeScript from "@mui/material/InitColorSchemeScript";

export default async function RootLayout({
  children,
  trailingActions,
}: Readonly<{
  children: React.ReactNode;
  trailingActions: React.ReactNode;
}>) {
  return (
    <html lang="en" className={roboto.variable} suppressHydrationWarning>
      <body>
        <InitColorSchemeScript attribute="data" defaultMode="dark" />
        <AppRouterCacheProvider>
          <ThemeProvider theme={theme} defaultMode="dark">
            <CssBaseline />
            <ClerkProvider>
              <Show when="signed-in">
                <Box
                  sx={{
                    height: "100dvh",
                    width: "100dvw",
                    display: "flex",
                    flexDirection: "column",
                    overflowY: "hidden",
                    // TODO: what should this be?
                  }}
                >
                  <ResponsiveDrawer trailingActions={trailingActions}>
                    <Box
                      sx={{
                        overflowY: "auto",
                      }}
                    >
                      {children}
                    </Box>
                  </ResponsiveDrawer>
                </Box>
              </Show>
              <Show when="signed-out">
                <SignInButton />
                <SignUpButton />
              </Show>
            </ClerkProvider>
          </ThemeProvider>
        </AppRouterCacheProvider>
      </body>
    </html>
  );
}
