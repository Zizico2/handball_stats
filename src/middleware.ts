import { clerkMiddleware } from "@clerk/nextjs/server";

export default clerkMiddleware();

// OpenNext currently supports only Edge Middleware. Next.js Proxy is Node-only.
export const runtime = "experimental-edge";

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
