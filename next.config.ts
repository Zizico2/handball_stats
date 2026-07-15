import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  cacheComponents: false,
  partialPrefetching: false,
};

export default nextConfig;
