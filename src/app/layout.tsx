import "./globals.css";
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

import { Box } from "@mui/material";
import InitColorSchemeScript from "@mui/material/InitColorSchemeScript";

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
                overflowY: "hidden",
                // TODO: what should this be?
              }}
            >
              <ResponsiveDrawer>
                <Box
                  sx={{
                    overflowY: "auto",
                  }}
                >
                  {children}
                </Box>
              </ResponsiveDrawer>
            </Box>
          </ThemeProvider>
        </AppRouterCacheProvider>
      </body>
    </html>
  );
}
