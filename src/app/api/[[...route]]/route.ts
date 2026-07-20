import { auth } from "@clerk/nextjs/server";
import { apiApp } from "@/server/api/app";

async function handleRequest(request: Request) {
  const { userId } = await auth();

  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let apiRequest = request;
  if (new URL(request.url).pathname === "/api/e2e/reset") {
    const headers = new Headers(request.headers);
    const resetAuthorization = headers.get("x-e2e-reset-authorization");
    headers.delete("x-e2e-reset-authorization");
    if (resetAuthorization) {
      headers.set("Authorization", resetAuthorization);
    }
    apiRequest = new Request(request.url, { method: request.method, headers });
  }

  return apiApp.fetch(apiRequest, {
    userId,
    E2E_RESET_TOKEN: process.env.E2E_RESET_TOKEN,
  });
}

export {
  handleRequest as DELETE,
  handleRequest as GET,
  handleRequest as POST,
  handleRequest as PUT,
};
