import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// If RSC prefetch or PPR shell streaming fails on Workers after deploy,
// set enableCacheInterception: false — see opennextjs/opennextjs-cloudflare#1223
export default defineCloudflareConfig();
