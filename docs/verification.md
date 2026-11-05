# Portfolio Verification

The standalone project must install and run from its own root with no sibling imports, package links, Docker COPY sources, chart references, or documentation links outside the project.

## Scope

Validation uses disposable SQLite files and offline mocks; no external database or test URL is required. Local checks do not prove a live deployment. Argo repository URLs must be configured before rollout. No production data is automatically migrated by the code change.

## Local Gates

```sh
npm ci
npm test
npm run build
npm run lint -w @portfolio/web
npm run format:check
node scripts/validate-project.mjs
```

Tests cover public project metadata/localization/sitemap, contact inbox privacy, sessions/CSRF, drafts and editor permissions, revision conflicts/restore, persistence after reopening SQLite, session expiry, migrations/checksums, atomic snapshot import and overwrite refusal, plus media storage/deletion safety. AWS operations tests are offline mocks, not cloud changes.

## Runtime Gates

Run `npm run build:runtime` to validate production bundles. Helm is required for `node scripts/validate-deployments.mjs` and `node ci/validate-sqlite.mjs`. The SQLite deployment check verifies one API replica, Recreate updates, a retained persistent database volume, and matching API/init-container paths. Builds/tests do not prove a live cluster rollout, DNS/TLS, registry access, current image security or a successful off-node backup restore.

Use the [deployment guide](deployment.md) before publishing. Configure repository URLs and administrator credentials yourself. Follow [SQLite Storage](sqlite.md) for existing-data transfer and a restore drill; then verify the site, sign-in, contact inbox, uploads and persistence after an API restart.
