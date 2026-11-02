# Portfolio Verification

The standalone project must install and run from its own root with no sibling imports, package links, Docker COPY sources, chart references, or documentation links outside the project.

## Split Results

The standalone suite passes 8 tests; 1 disposable-PostgreSQL integration is skipped without its test URL. TypeScript, production build, frontend lint, formatting and project-boundary checks pass. Charts lint/render and native/legacy database-profile validators pass with a temporary local Helm binary. HTTP smoke checks pass for the frontend, public API, project pages, sitemap and project stylesheet. The future Git repository is not initialized, and Argo repository URLs remain explicit placeholders. No live database migration, Docker image execution, Kubernetes rollout, cloud or registrar operation was performed.

## Local Gates

```sh
npm ci
npm test
npm run build
npm run lint -w @portfolio/web
npm run format:check
node scripts/validate-project.mjs
```

Tests cover public project metadata/localization/sitemap, contact inbox privacy, sessions/CSRF, drafts and editor permissions, revision conflicts/restore, file persistence and upload/deletion safety. AWS operations tests are offline mocks, not cloud changes.

## Runtime Gates

The PostgreSQL test is skipped unless `TEST_PORTFOLIO_DATABASE_URL` identifies a disposable database. Helm is required for `node scripts/validate-deployments.mjs`, `node ci/validate-database-hosts.mjs`, and `node ci/validate-native-databases.mjs`. Builds/tests do not prove a live cluster rollout, DNS/TLS, registry access, current image security or a successful backup restore.

Use the [deployment guide](deployment.md) before publishing. Replace the future repository placeholder; configure administrator credentials yourself. Real cloud resources and production data were not created, migrated or changed during the filesystem split.
