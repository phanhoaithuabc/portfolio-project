import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { applyMigrations } from "../services/portfolio/src/migrations.ts";

test("portfolio migrations apply once and reject edited history", async () => {
  const directory = await mkdtemp(join(tmpdir(), "portfolio-migrations-"));
  const database = new DatabaseSync(":memory:");
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
    assert.deepEqual(await applyMigrations(database, location), [
      "001_notes.sql",
      "002_seed.sql",
    ]);
    assert.deepEqual(await applyMigrations(database, location), []);
    await writeFile(
      join(directory, "002_seed.sql"),
      "INSERT INTO notes VALUES (1);\r\n",
    );
    assert.deepEqual(await applyMigrations(database, location), []);
    await writeFile(
      join(directory, "001_notes.sql"),
      "CREATE TABLE notes (id bigint PRIMARY KEY);\n",
    );
    await assert.rejects(
      applyMigrations(database, location),
      /001_notes\.sql changed after it was applied/,
    );
  } finally {
    database.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("portfolio project migrations apply cleanly and are recorded once", async () => {
  const database = new DatabaseSync(":memory:");
  const location = new URL(
    "../services/portfolio/migrations/",
    import.meta.url,
  );
  try {
    const applied = await applyMigrations(database, location);
    assert.ok(applied.length >= 3);
    assert.deepEqual(await applyMigrations(database, location), []);
    const recorded = database
      .prepare("SELECT count(*) AS count FROM portfolio_schema_migrations")
      .get();
    assert.equal(recorded?.count, applied.length);
  } finally {
    database.close();
  }
});
