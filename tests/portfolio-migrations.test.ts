import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { applyMigrations } from "../services/portfolio/src/migrations.ts";

function clientFor(database: PGlite) {
  return {
    async query(text: string, values?: unknown[]) {
      if (values) return database.query<Record<string, unknown>>(text, values);
      return (await database.exec(text)).at(-1) ?? { rows: [] };
    },
  };
}

test("portfolio migrations apply once and reject edited history", async () => {
  const directory = await mkdtemp(join(tmpdir(), "portfolio-migrations-"));
  const database = new PGlite();
  const client = clientFor(database);
  const location = pathToFileURL(`${directory}/`);
  try {
    await writeFile(
      join(directory, "001_notes.sql"),
      "CREATE TABLE notes (id integer PRIMARY KEY);\n",
    );
    await writeFile(
      join(directory, "002_seed.sql"),
      "INSERT INTO notes VALUES (1);\n",
    );
    assert.deepEqual(await applyMigrations(client, location), [
      "001_notes.sql",
      "002_seed.sql",
    ]);
    assert.deepEqual(await applyMigrations(client, location), []);
    await writeFile(
      join(directory, "002_seed.sql"),
      "INSERT INTO notes VALUES (1);\r\n",
    );
    assert.deepEqual(await applyMigrations(client, location), []);
    await writeFile(
      join(directory, "001_notes.sql"),
      "CREATE TABLE notes (id bigint PRIMARY KEY);\n",
    );
    await assert.rejects(
      applyMigrations(client, location),
      /001_notes\.sql changed after it was applied/,
    );
  } finally {
    await database.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("portfolio project migrations apply cleanly and are recorded once", async () => {
  const database = new PGlite();
  const client = clientFor(database);
  const location = new URL(
    "../services/portfolio/migrations/",
    import.meta.url,
  );
  try {
    const applied = await applyMigrations(client, location);
    assert.ok(applied.length >= 3);
    assert.deepEqual(await applyMigrations(client, location), []);
    const recorded = await database.query<{ count: number }>(
      "SELECT count(*)::int AS count FROM portfolio_schema_migrations",
    );
    assert.equal(recorded.rows[0].count, applied.length);
  } finally {
    await database.close();
  }
});
