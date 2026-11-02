import { portfolioPool } from "./postgres.ts";
import { initialContent } from "./content.ts";
import { applyMigrations } from "./migrations.ts";
const pool = portfolioPool();
const client = await pool.connect();
try {
  const applied = await applyMigrations(
    client,
    new URL("../migrations/", import.meta.url),
  );
  await client.query(
    "INSERT INTO portfolio_content (id, payload) VALUES (1, $1) ON CONFLICT DO NOTHING",
    [initialContent],
  );
  console.log(
    applied.length
      ? `Portfolio migrations applied: ${applied.join(", ")}; existing content preserved`
      : "Portfolio schema is current; existing content preserved",
  );
} finally {
  client.release();
  await pool.end();
}
