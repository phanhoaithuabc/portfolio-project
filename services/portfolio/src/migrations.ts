import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import type { DatabaseSync } from "node:sqlite";

export async function applyMigrations(database: DatabaseSync, directory: URL) {
  const migrations = await Promise.all(
    (await readdir(directory))
      .filter((name) => /^\d+_.+\.sql$/.test(name))
      .sort()
      .map(async (version) => {
        const sql = await readFile(new URL(version, directory), "utf8");
        return {
          version,
          sql,
          checksum: createHash("sha256")
            .update(sql.replace(/\r\n/g, "\n"))
            .digest("hex"),
        };
      }),
  );
  database.exec("BEGIN IMMEDIATE");
  try {
    database.exec(
      "CREATE TABLE IF NOT EXISTS portfolio_schema_migrations (version TEXT PRIMARY KEY, checksum TEXT NOT NULL, applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')))",
    );
    const applied = new Map(
      database
        .prepare("SELECT version, checksum FROM portfolio_schema_migrations")
        .all()
        .map((row) => [String(row.version), String(row.checksum)]),
    );
    const pending = migrations.filter((migration) => {
      const recorded = applied.get(migration.version);
      if (recorded && recorded !== migration.checksum)
        throw new Error(
          `Migration ${migration.version} changed after it was applied; add a new migration instead.`,
        );
      return !recorded;
    });
    for (const migration of pending) {
      database.exec(migration.sql);
      database
        .prepare(
          "INSERT INTO portfolio_schema_migrations (version, checksum) VALUES (?, ?)",
        )
        .run(migration.version, migration.checksum);
    }
    database.exec("COMMIT");
    return pending.map((migration) => migration.version);
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}
