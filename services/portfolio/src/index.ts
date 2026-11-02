import session from "express-session";
import connectPg from "connect-pg-simple";
import { randomBytes } from "node:crypto";
import { createPortfolioApp } from "./app.ts";
import { FilePortfolio } from "./file-repository.ts";
import { S3PortfolioMediaStore } from "./s3-media.ts";
import { portfolioPool, PostgresPortfolio } from "./postgres.ts";
import { graceful } from "../../../packages/observability/src/lifecycle.ts";
const preview = process.env.PORTFOLIO_STORE === "file";
const proxyHops = Number(process.env.PORTFOLIO_TRUST_PROXY_HOPS ?? 0);
if (![0, 1, 2].includes(proxyHops))
  throw new Error(
    "PORTFOLIO_TRUST_PROXY_HOPS must be 0, 1, or 2 for the known proxy chain",
  );
if (preview && process.env.NODE_ENV === "production")
  throw new Error("File preview mode is forbidden in production");
const mediaBucket = process.env.PORTFOLIO_MEDIA_S3_BUCKET;
const mediaRegion =
  process.env.PORTFOLIO_MEDIA_S3_REGION ?? process.env.AWS_REGION;
if (mediaBucket && !mediaRegion)
  throw new Error("PORTFOLIO_MEDIA_S3_REGION or AWS_REGION is required");
const mediaStore = mediaBucket
  ? new S3PortfolioMediaStore({
      bucket: mediaBucket,
      region: mediaRegion!,
      endpoint: process.env.PORTFOLIO_MEDIA_S3_ENDPOINT,
      prefix: process.env.PORTFOLIO_MEDIA_S3_PREFIX,
    })
  : undefined;
const pool = preview ? undefined : portfolioPool();
const secret =
  process.env.PORTFOLIO_SESSION_SECRET ??
  (preview ? randomBytes(48).toString("hex") : "");
const repository = pool
  ? new PostgresPortfolio(pool)
  : new FilePortfolio(process.env.PORTFOLIO_DATA_FILE ?? "data/portfolio.json");
await repository.ready();
const PgStore = connectPg(session);
const sessionStore = pool
  ? new PgStore({
      pool,
      tableName: "portfolio_sessions",
      createTableIfMissing: false,
      pruneSessionInterval: 900,
    })
  : new session.MemoryStore();
const server = createPortfolioApp(repository, {
  origin: process.env.PORTFOLIO_PUBLIC_ORIGIN ?? "http://127.0.0.1:5174",
  sessionSecret: secret,
  sessionStore,
  secureCookies:
    process.env.PORTFOLIO_COOKIE_SECURE === "true" ||
    process.env.NODE_ENV === "production",
  username: process.env.PORTFOLIO_ADMIN_USERNAME ?? "admin",
  passwordHash: process.env.PORTFOLIO_ADMIN_PASSWORD_HASH,
  editorUsername: process.env.PORTFOLIO_EDITOR_USERNAME,
  editorPasswordHash: process.env.PORTFOLIO_EDITOR_PASSWORD_HASH,
  uploadDirectory: process.env.PORTFOLIO_UPLOAD_DIR,
  mediaStore,
  trustProxy: proxyHops,
}).listen(
  Number(process.env.PORTFOLIO_PORT ?? 4010),
  preview ? "127.0.0.1" : (process.env.HOST ?? "127.0.0.1"),
);
graceful(server, async () => {
  await pool?.end();
});
console.log(
  `Portfolio API: http://127.0.0.1:${process.env.PORTFOLIO_PORT ?? 4010}; store=${preview ? "local preview" : "PostgreSQL"}; admin=${process.env.PORTFOLIO_ADMIN_PASSWORD_HASH ? "configured" : "disabled"}`,
);
