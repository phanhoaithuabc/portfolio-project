import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";
import bcrypt from "bcryptjs";
import session from "express-session";
import { createPortfolioApp } from "../services/portfolio/src/app.ts";
import {
  openPortfolioDatabase,
  SqlitePortfolio,
  SqliteSessionStore,
} from "../services/portfolio/src/sqlite.ts";
import { initialContent } from "../services/portfolio/src/content.ts";
import { applyMigrations } from "../services/portfolio/src/migrations.ts";
import { importSnapshot } from "../services/portfolio/src/import-snapshot.ts";

test("SQLite persists content and sessions and rejects stale revisions across connections", async () => {
  const directory = await mkdtemp(join(tmpdir(), "portfolio-sqlite-"));
  const filename = join(directory, "portfolio.sqlite");
  let database = openPortfolioDatabase(filename);
  try {
    await applyMigrations(
      database,
      new URL("../services/portfolio/migrations/", import.meta.url),
    );
    database
      .prepare("INSERT INTO portfolio_content(id,payload) VALUES(1,?)")
      .run(JSON.stringify(initialContent));
    const repository = new SqlitePortfolio(database);
    const original = await repository.read();
    const other = openPortfolioDatabase(filename);
    try {
      const edited = {
        ...original,
        profile: { ...original.profile, headline: "SQLite persistence" },
      };
      const results = await Promise.all([
        repository.save(edited),
        new SqlitePortfolio(other).save(edited),
      ]);
      assert.equal(results.filter(Boolean).length, 1);
      assert.equal(await repository.restoreVersion(999, 1), null);
      assert.equal((await repository.restoreVersion(0, 1))?.revision, 2);
      assert.equal((await repository.listVersions()).length, 2);
    } finally {
      other.close();
    }
    const store = new SqliteSessionStore(database);
    const cookie = new session.Cookie();
    cookie.maxAge = 60000;
    await new Promise<void>((resolve, reject) =>
      store.set(
        "session",
        {
          cookie,
          marker: "persistent",
        } as session.SessionData,
        (error) => (error ? reject(error) : resolve()),
      ),
    );
    database.close();
    database = openPortfolioDatabase(filename);
    assert.equal((await new SqlitePortfolio(database).read()).revision, 2);
    const repositoryAfterRestart = new SqlitePortfolio(database);
    const contact = await repositoryAfterRestart.createContact({
      name: "Visitor",
      email: "visitor@example.com",
      message: "Hello from SQLite",
      subject: "Test",
    });
    assert.equal(
      (await repositoryAfterRestart.updateContactStatus(contact.id, "read"))
        ?.status,
      "read",
    );
    assert.equal((await repositoryAfterRestart.listContacts(10)).length, 1);
    assert.equal(
      await repositoryAfterRestart.updateContactStatus("missing", "read"),
      null,
    );
    await repositoryAfterRestart.setProjectPassword("project", "password-hash");
    assert.equal(
      await repositoryAfterRestart.projectPasswordHash("project"),
      "password-hash",
    );
    await repositoryAfterRestart.setProjectPassword("project", null);
    assert.equal(
      await repositoryAfterRestart.projectPasswordHash("project"),
      undefined,
    );
    const event = {
      page: "/",
      event: "view" as const,
      referrerHost: "search.example",
    };
    await repositoryAfterRestart.recordAnalytics(event);
    await repositoryAfterRestart.recordAnalytics(event);
    assert.equal((await repositoryAfterRestart.listAnalytics())[0].count, 2);
    const reopened = new SqliteSessionStore(database);
    await new Promise<void>((resolve, reject) =>
      reopened.get("session", (error, value) => {
        if (error) return reject(error);
        assert.equal(
          (value as unknown as { marker: string }).marker,
          "persistent",
        );
        resolve();
      }),
    );
    database.prepare("UPDATE portfolio_sessions SET expire=0").run();
    reopened.get("session", (error, value) => {
      assert.ifError(error);
      assert.equal(value, null);
    });
  } finally {
    database.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("snapshot import preserves data, refuses overwrites and rolls back invalid records", async () => {
  const database = openPortfolioDatabase(":memory:");
  try {
    await applyMigrations(
      database,
      new URL("../services/portfolio/migrations/", import.meta.url),
    );
    const snapshot = {
      content: { payload: structuredClone(initialContent), revision: 7 },
      versions: [
        {
          payload: structuredClone(initialContent),
          revision: 6,
          created_at: "2026-01-01T00:00:00Z",
        },
      ],
      contacts: [
        {
          id: "82608e97-c5a3-4f9a-9b20-38926ce11a02",
          name: "Visitor",
          email: "visitor@example.com",
          subject: "Hello",
          message: "Imported",
          status: "read",
          created_at: "2026-01-01T00:00:00Z",
        },
      ],
      passwords: [
        {
          project_id: initialContent.projects[0].id,
          password_hash: "hash",
          updated_at: "2026-01-01T00:00:00Z",
        },
      ],
      analytics: [
        {
          day: "2026-11-05",
          page_key: "/",
          event_type: "view",
          referrer_host: "",
          count: 4,
        },
      ],
    };
    assert.throws(
      () =>
        importSnapshot(database, {
          ...snapshot,
          versions: [...snapshot.versions, ...snapshot.versions],
        }),
      /UNIQUE/,
    );
    assert.equal(
      database.prepare("SELECT count(*) AS count FROM portfolio_content").get()
        ?.count,
      0,
    );
    assert.equal(importSnapshot(database, snapshot).revision, 7);
    const repository = new SqlitePortfolio(database);
    assert.equal((await repository.read()).revision, 7);
    assert.equal((await repository.listVersions())[0].revision, 6);
    assert.equal((await repository.listContacts(10))[0].message, "Imported");
    assert.equal(
      await repository.projectPasswordHash(initialContent.projects[0].id),
      "hash",
    );
    assert.equal(
      database.prepare("SELECT count FROM portfolio_analytics_daily").get()
        ?.count,
      4,
    );
    assert.throws(() => importSnapshot(database, snapshot), /empty target/);
  } finally {
    database.close();
  }
});

test("SQLite HTTP content and authenticated sessions survive restart and logout revokes access", async () => {
  const directory = await mkdtemp(join(tmpdir(), "portfolio-sqlite-http-"));
  const filename = join(directory, "portfolio.sqlite");
  let database = openPortfolioDatabase(filename);
  await applyMigrations(
    database,
    new URL("../services/portfolio/migrations/", import.meta.url),
  );
  database
    .prepare("INSERT INTO portfolio_content(id,payload) VALUES(1,?)")
    .run(JSON.stringify(initialContent));
  const passwordHash = await bcrypt.hash("sqlite-test-only-password", 4);
  const origin = "http://localhost:5174";
  const start = () =>
    createPortfolioApp(new SqlitePortfolio(database), {
      origin,
      sessionSecret: "sqlite-http-test-only-secret-at-least-32-characters",
      sessionStore: new SqliteSessionStore(database),
      secureCookies: false,
      username: "admin",
      passwordHash,
      uploadDirectory: join(directory, "uploads"),
    }).listen(0, "127.0.0.1");
  let server = start();
  let cookie = "";
  let csrf = "";
  const call = async (path: string, method = "GET", body?: unknown) => {
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const response = await fetch(`http://127.0.0.1:${address.port}${path}`, {
      method,
      headers: {
        origin,
        cookie,
        "X-CSRF-Token": csrf,
        "content-type": "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const received = response.headers.get("set-cookie");
    if (received) cookie = received.split(";")[0];
    return response;
  };
  const stop = () =>
    new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  try {
    await once(server, "listening");
    assert.equal((await call("/ready")).status, 200);
    csrf = (await (await call("/api/admin/session")).json()).csrf;
    const login = await call("/api/admin/login", "POST", {
      username: "admin",
      password: "sqlite-test-only-password",
    });
    assert.equal(login.status, 200);
    csrf = (await login.json()).csrf;
    const content = await (await call("/api/admin/content")).json();
    content.profile.headline = "Persisted through the SQLite HTTP API";
    assert.equal(
      (await call("/api/admin/content", "PUT", content)).status,
      200,
    );
    await stop();
    database.close();
    database = openPortfolioDatabase(filename);
    server = start();
    await once(server, "listening");
    const restored = await call("/api/admin/content");
    assert.equal(restored.status, 200);
    assert.equal(
      (await restored.json()).profile.headline,
      content.profile.headline,
    );
    assert.equal((await call("/api/admin/logout", "POST")).status, 200);
    assert.equal((await call("/api/admin/content")).status, 401);
  } finally {
    await stop();
    database.close();
    await rm(directory, { recursive: true, force: true });
  }
});
