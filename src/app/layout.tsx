import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";
import AppBar from "@mui/material/AppBar";
import CssBaseline from "@mui/material/CssBaseline";
import { ThemeProvider } from "@mui/material/styles";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v15-appRouter";
import { Roboto } from "next/font/google";
import ResponsiveDrawer from "@/components/ResponsiveDrawer";
import theme from "../theme";

const roboto = Roboto({
  weight: ["300", "400", "500", "700"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-roboto",
});

import InitColorSchemeScript from "@mui/material/InitColorSchemeScript";
import { Box } from "@mui/material";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={roboto.variable} suppressHydrationWarning>
      <body>
        <InitColorSchemeScript attribute="data" defaultMode="dark" />
        <AppRouterCacheProvider>
          <ThemeProvider theme={theme} defaultMode="dark">
            <CssBaseline />
            <Box
              sx={{
                height: "100dvh",
                width: "100dvw",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <ResponsiveDrawer>{children}</ResponsiveDrawer>
            </Box>
          </ThemeProvider>
        </AppRouterCacheProvider>
      </body>
    </html>
  );
}
