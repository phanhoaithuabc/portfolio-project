import { openPortfolioDatabase } from "./sqlite.ts";
import { initialContent } from "./content.ts";
import { applyMigrations } from "./migrations.ts";
const database = openPortfolioDatabase();
try {
  const applied = await applyMigrations(
    database,
    new URL("../migrations/", import.meta.url),
  );
  database
    .prepare(
      "INSERT INTO portfolio_content (id, payload) VALUES (1, ?) ON CONFLICT DO NOTHING",
    )
    .run(JSON.stringify(initialContent));
  console.log(
    applied.length
      ? `Portfolio migrations applied: ${applied.join(", ")}; existing content preserved`
      : "Portfolio schema is current; existing content preserved",
  );
} finally {
  database.close();
}
