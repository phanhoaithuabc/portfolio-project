import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";

interface MigrationClient {
  query(
    text: string,
    values?: unknown[],
  ): Promise<{ rows: Record<string, unknown>[] }>;
}

const lockKey = 14873210;

export async function applyMigrations(client: MigrationClient, directory: URL) {
  await client.query("SELECT pg_advisory_lock($1)", [lockKey]);
  try {
    await client.query(
      "CREATE TABLE IF NOT EXISTS portfolio_schema_migrations (version text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())",
    );
    const applied = new Map(
      (
        await client.query(
          "SELECT version, checksum FROM portfolio_schema_migrations",
        )
      ).rows.map((row) => [String(row.version), String(row.checksum)]),
    );
    const pending: { version: string; sql: string; checksum: string }[] = [];
    for (const version of (await readdir(directory))
      .filter((name) => /^\d+_.+\.sql$/.test(name))
      .sort()) {
      const sql = await readFile(new URL(version, directory), "utf8");
      // Normalize line endings so Windows and Linux checkouts record the same checksum.
      const checksum = createHash("sha256")
        .update(sql.replace(/\r\n/g, "\n"))
        .digest("hex");
      const recorded = applied.get(version);
      if (recorded && recorded !== checksum)
        throw new Error(
          `Migration ${version} changed after it was applied; add a new migration instead.`,
        );
      if (!recorded) pending.push({ version, sql, checksum });
    }
    for (const migration of pending) {
      await client.query("BEGIN");
      try {
        await client.query("SET LOCAL lock_timeout = '10s'");
        await client.query(migration.sql);
        await client.query(
          "INSERT INTO portfolio_schema_migrations (version, checksum) VALUES ($1, $2)",
          [migration.version, migration.checksum],
        );
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }
    return pending.map((migration) => migration.version);
  } finally {
    await client.query("SELECT pg_advisory_unlock($1)", [lockKey]);
  }
}
