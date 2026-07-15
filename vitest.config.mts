import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  cloudflareTest,
  readD1Migrations,
} from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": path.join(rootDir, "src"),
    },
  },
  plugins: [
    cloudflareTest(async () => {
      const migrationsPath = path.join(rootDir, "drizzle_flat");
      const migrations = await readD1Migrations(migrationsPath);

      return {
        // Isolated module tests must not depend on a built OpenNext worker.
        main: "./test/d1/worker.ts",
        wrangler: {
          configPath: "./wrangler.toml",
        },
        miniflare: {
          bindings: {
            TEST_MIGRATIONS: migrations,
          },
        },
      };
    }),
  ],
  test: {
    include: ["test/d1/**/*.test.ts"],
    setupFiles: ["./test/d1/apply-migrations.ts"],
  },
});
