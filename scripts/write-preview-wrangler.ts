import { resolve } from "node:path";

function usage(): never {
  throw new Error(
    "Usage: bun run write-preview-wrangler <database-name> <database-id> <output-path>",
  );
}

const [databaseName, databaseId, outputPath, ...extra] = process.argv.slice(2);
if (!databaseName || !databaseId || !outputPath || extra.length > 0) usage();

const source = Bun.TOML.parse(await Bun.file("wrangler.toml").text()) as Record<
  string,
  unknown
>;

delete source.routes;
source.workers_dev = false;
source.preview_urls = true;
source.d1_databases = [
  {
    binding: "DB",
    database_name: databaseName,
    database_id: databaseId,
    migrations_dir: "drizzle_flat",
  },
];

const destination = resolve(outputPath);
await Bun.write(destination, `${JSON.stringify(source, null, 2)}\n`);
console.log(`Wrote ${destination}`);
