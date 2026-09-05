import "server-only";

import {
  DbClient,
  type DehydratedDbState,
  type LiveQueryOptions,
} from "@tanstack/db";
import { QueryClient } from "@tanstack/query-core";
import { hc } from "hono/client";
import type { ApiApp } from "@/server/api/app";
import { apiApp } from "@/server/api/app";
import {
  type CollectionQueryFns,
  createCollectionQueries,
} from "@/server/api/client";

function createServerApiClient(userId: string) {
  const fetchForUser = async (request: RequestInfo | URL, init?: RequestInit) =>
    apiApp.request(request, init, {
      userId,
      E2E_RESET_TOKEN: process.env.E2E_RESET_TOKEN,
    });

  return hc<ApiApp>("http://tanstack-db-ssr", {
    fetch: fetchForUser as typeof fetch,
  });
}

export function createServerDbClient(userId: string): DbClient {
  const apiClient = createServerApiClient(userId);
  const collectionQueries: CollectionQueryFns =
    createCollectionQueries(apiClient);

  return new DbClient({
    collectionQueries,
    queryClient: new QueryClient(),
  });
}

export async function preloadDbState(
  userId: string,
  queries: LiveQueryOptions[],
): Promise<DehydratedDbState> {
  const client = createServerDbClient(userId);

  try {
    await Promise.all(queries.map((query) => client.preloadLiveQuery(query)));
    return client.dehydrate();
  } finally {
    await client.cleanup();
  }
}
