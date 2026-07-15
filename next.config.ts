import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
import type { NextConfig } from "next";

initOpenNextCloudflareForDev();

const nextConfig: NextConfig = {
  reactCompiler: true,
  cacheComponents: false,
  partialPrefetching: false,
  deploymentId: process.env.DEPLOYMENT_VERSION,
};

export default nextConfig;
