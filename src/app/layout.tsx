import "./globals.css";
import { ClerkProvider, Show } from "@clerk/nextjs";
import { Roboto } from "next/font/google";
import ResponsiveDrawer from "@/components/ResponsiveDrawer";
import SignedOutEntry from "../components/SignedOutEntry";
import { Providers } from "./providers";

const roboto = Roboto({
  weight: ["300", "400", "500", "700"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-roboto",
});

export default async function RootLayout({
  children,
  trailingActions,
}: Readonly<{
  children: React.ReactNode;
  trailingActions: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${roboto.variable} dark`}
      suppressHydrationWarning
    >
      <body className="bg-background font-sans text-foreground">
        <Providers>
          <ClerkProvider>
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
          </ClerkProvider>
        </Providers>
      </body>
    </html>
  );
}
