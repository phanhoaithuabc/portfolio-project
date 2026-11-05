import { readFile } from "node:fs/promises";
import { openPortfolioDatabase } from "../services/portfolio/src/sqlite.ts";
import { applyMigrations } from "../services/portfolio/src/migrations.ts";
import { importSnapshot } from "../services/portfolio/src/import-snapshot.ts";

const [filename] = process.argv.slice(2);
if (!filename)
  throw new Error("Usage: npm run portfolio:import -- SNAPSHOT.json");
const input: unknown = JSON.parse(await readFile(filename, "utf8"));
const database = openPortfolioDatabase();
try {
  await applyMigrations(
    database,
    new URL("../services/portfolio/migrations/", import.meta.url),
  );
  console.log("Imported portfolio snapshot:", importSnapshot(database, input));
} finally {
  database.close();
}
