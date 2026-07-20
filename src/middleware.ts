import { clerkMiddleware } from "@clerk/nextjs/server";
import { type NextFetchEvent, NextRequest } from "next/server";

const clerk = clerkMiddleware();

export default function middleware(
  request: NextRequest,
  event: NextFetchEvent,
) {
  if (request.nextUrl.pathname !== "/api/e2e/reset") {
    return clerk(request, event);
  }

  // Clerk treats any bearer value as its own session token and ignores the
  // valid session cookie. Preserve the reset credential for the route while
  // authenticating this one request from Clerk's cookie as usual.
  const headers = new Headers(request.headers);
  const resetAuthorization = headers.get("Authorization");
  headers.delete("Authorization");
  headers.delete("x-e2e-reset-authorization");
  if (resetAuthorization) {
    headers.set("x-e2e-reset-authorization", resetAuthorization);
  }

  return clerk(
    new NextRequest(request.url, { method: request.method, headers }),
    event,
  );
}

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
