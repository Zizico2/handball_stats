import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";
import { Roboto } from "next/font/google";
import AuthGatedShell from "@/components/AuthGatedShell";
import { Providers } from "./providers";

export const instant = false;

const roboto = Roboto({
  weight: ["300", "400", "500", "700"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-roboto",
});

export default function RootLayout({
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
            <AuthGatedShell trailingActions={trailingActions}>
              {children}
            </AuthGatedShell>
          </ClerkProvider>
        </Providers>
      </body>
    </html>
  );
}
