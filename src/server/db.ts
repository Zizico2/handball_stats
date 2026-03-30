import "server-only";

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createDb } from "@/db";

export async function getDb() {
  const { env } = (await getCloudflareContext({ async: true })) as unknown as {
    env: Env;
  };

  return createDb(env.DB);
}
