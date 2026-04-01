import { Glob } from "bun";

async function flattenMigrations() {
  // Target only the migration.sql files inside the nested folders
  const glob = new Glob("drizzle/*/migration.sql");
  const destDir = "drizzle_flat";

  for await (const path of glob.scan(".")) {
    // path looks like "drizzle/0000_something/migration.sql"
    const parts = path.split("/");
    const folderName = parts[1];

    const destPath = `${destDir}/${folderName}.sql`;

    // Bun.write handles directory creation and clones the file instantly
    await Bun.write(destPath, Bun.file(path));

    console.log(`Flattened: ${folderName}.sql`);
  }
}

await flattenMigrations();
