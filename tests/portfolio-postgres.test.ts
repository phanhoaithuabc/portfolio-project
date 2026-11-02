import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { Pool } from "pg";
import { PostgresPortfolio } from "../services/portfolio/src/postgres.ts";
import { initialContent } from "../services/portfolio/src/content.ts";
test(
  "portfolio PostgreSQL content persists with atomic revision checks",
  { skip: !process.env.TEST_PORTFOLIO_DATABASE_URL },
  async () => {
    const pool = new Pool({
      connectionString: process.env.TEST_PORTFOLIO_DATABASE_URL,
      max: 1,
    });
    try {
      await pool.query("BEGIN");
      await pool.query(
        await readFile(
          new URL(
            "../services/portfolio/migrations/001_content.sql",
            import.meta.url,
          ),
          "utf8",
        ),
      );
      for (const migration of [
        "002_portfolio_features.sql",
        "003_private_projects_analytics.sql",
      ])
        await pool.query(
          await readFile(
            new URL(
              `../services/portfolio/migrations/${migration}`,
              import.meta.url,
            ),
            "utf8",
          ),
        );
      await pool.query(
        "INSERT INTO portfolio_content (id, payload) VALUES (1, $1) ON CONFLICT DO NOTHING",
        [initialContent],
      );
      const repository = new PostgresPortfolio(pool);
      const original = await repository.read();
      const edited = {
        ...original,
        profile: {
          ...original.profile,
          headline: "PostgreSQL integration test",
        },
      };
      assert.equal(
        (await repository.save(edited))?.revision,
        original.revision + 1,
      );
      assert.equal(
        (await repository.read()).profile.headline,
        edited.profile.headline,
      );
      assert.equal(await repository.save(edited), null);
      await repository.setProjectPassword(
        initialContent.projects[0].id,
        "$2b$12$integration-test-hash-placeholder",
      );
      assert.equal(
        await repository.projectPasswordHash(initialContent.projects[0].id),
        "$2b$12$integration-test-hash-placeholder",
      );
      await repository.setProjectPassword(initialContent.projects[0].id, null);
      assert.equal(
        await repository.projectPasswordHash(initialContent.projects[0].id),
        undefined,
      );
      await repository.recordAnalytics({
        page: "/",
        event: "view",
        referrerHost: "search.example",
      });
      await repository.recordAnalytics({
        page: "/",
        event: "view",
        referrerHost: "search.example",
      });
      assert.equal(
        (await repository.listAnalytics()).find(
          (row) => row.page === "/" && row.event === "view",
        )?.count,
        2,
      );
    } finally {
      await pool.query("ROLLBACK");
      await pool.end();
    }
  },
);
