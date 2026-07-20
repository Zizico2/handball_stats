export {};

const persistTo = process.env.E2E_D1_STATE_DIR;
const envFile = process.env.E2E_WRANGLER_ENV_FILE;
const port = process.env.PLAYWRIGHT_PORT ?? "8789";

if (!persistTo || !envFile) {
  throw new Error(
    "E2E_D1_STATE_DIR and E2E_WRANGLER_ENV_FILE are required to start the local Worker",
  );
}

const child = Bun.spawn(
  [
    "bunx",
    "wrangler",
    "dev",
    "--config",
    "wrangler-e2e.toml",
    "--local",
    "--ip",
    "127.0.0.1",
    "--port",
    port,
    "--persist-to",
    persistTo,
    "--env-file",
    envFile,
  ],
  {
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  },
);

process.exit(await child.exited);
