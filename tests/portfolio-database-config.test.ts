import { test } from "node:test";
import assert from "node:assert/strict";
import { assertPortfolioDatabaseHost } from "../services/portfolio/src/database-config.ts";
test("portfolio database configuration refuses the DailyPick PostgreSQL host", () => {
  const expected = "postgres.portfolio-data.svc.cluster.local";
  assert.doesNotThrow(() =>
    assertPortfolioDatabaseHost(
      `postgresql://portfolio:fixture@${expected}:5432/portfolio`,
      expected,
    ),
  );
  assert.throws(
    () =>
      assertPortfolioDatabaseHost(
        "postgresql://portfolio:fixture@postgres.data.svc.cluster.local:5432/portfolio",
        expected,
      ),
    /dedicated PostgreSQL host/,
  );
  assert.throws(
    () =>
      assertPortfolioDatabaseHost("https://example.com/portfolio", expected),
    /PostgreSQL connection/,
  );
  assert.throws(
    () =>
      assertPortfolioDatabaseHost(
        "invalid-url-with-fixture-password",
        expected,
      ),
    /^Error: Portfolio database URL is invalid$/,
  );
  assert.doesNotThrow(() =>
    assertPortfolioDatabaseHost(
      "postgresql://portfolio:fixture@localhost:5433/portfolio",
    ),
  );
});
