import { auth } from "@clerk/nextjs/server";
import { apiApp } from "@/server/api/app";

async function handleRequest(request: Request) {
  const { userId } = await auth();

  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  return apiApp.fetch(request, { userId });
}

export {
  handleRequest as DELETE,
  handleRequest as GET,
  handleRequest as POST,
  handleRequest as PUT,
};
