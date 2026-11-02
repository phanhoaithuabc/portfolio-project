# Personal Portfolio

Standalone React/Vite portfolio and Express/PostgreSQL content studio. This directory is a complete project: it does not import, install, build, or deploy code from the DailyPick project. Git is intentionally not initialized here; create the portfolio repository when ready.

## Features

English/Vietnamese content, structured case studies, custom pages, project layouts, SEO/Open Graph metadata, sitemap, search/categories, contact form/inbox, owner/editor sessions, draft preview, revision history/restore, project JSON import/export, protected project links, cookieless aggregate analytics, and image uploads with reference-aware deletion are included. See [Studio and Administrator Setup](docs/portfolio.md) for privacy, retention and access details.

## Local Development

Run all commands from this directory. Requires Node.js 24 LTS.

```sh
npm ci
npm run portfolio:preview
```

Open http://127.0.0.1:5174/. The API listens on loopback port 4010. File preview persists content and uploads under the local data directory; it is forbidden in production. Administrator login remains disabled until configured with your own bcrypt password hash and session secret in the ignored `.env.portfolio` file. No default administrator credentials are provided.

For PostgreSQL development, set `PORTFOLIO_POSTGRES_PASSWORD` to a unique local password in your terminal, run `docker compose up -d`, configure `PORTFOLIO_DATABASE_URL` with port 5433 in `.env.portfolio`, then run `npm run portfolio:migrate` and `npm run dev`. See [Studio Setup](docs/portfolio.md).

## Validate

```sh
npm test
npm run build
npm run lint -w @portfolio/web
npm run format:check
node scripts/validate-project.mjs
node scripts/validate-deployments.mjs
node ci/validate-native-databases.mjs
```

Helm is required for chart checks. The PostgreSQL integration test requires `TEST_PORTFOLIO_DATABASE_URL` pointing only to a disposable database.

## Deployment

The root Dockerfile builds the portfolio API image; `apps/portfolio/Dockerfile` builds the frontend. The root Jenkinsfile tests/publishes these images and promotes only the local portfolio GitOps values. Set the future repository URL in `deploy/argocd/portfolio.yaml` before using Argo CD; its `REPLACE_ME` value deliberately prevents deploying the previous combined repository. No GitHub repository, infrastructure, DNS, or live credentials are created by this split.

Keep the media PVC, database, runtime secrets, administrator credentials, and backups independent of other applications. Optional Terraform/platform tooling is local to this project and never needs a sibling checkout. Its cloud roots compose local network/compute modules and retain state-migration declarations; see [Terraform layout](infra/README.md). A single host is not high availability.

## Documentation

- [Architecture](docs/architecture.md)
- [Studio and Administrator Setup](docs/portfolio.md)
- [Deployment and CI](docs/deployment.md)
- [Native PostgreSQL](docs/native-postgres.md)
- [DNS and HTTPS](docs/domain-pavietnam.md)
- [Capacity](docs/ec2-sizing.md)
- [Observability](docs/observability.md)
- [Incident Runbook](docs/runbooks/incidents.md)
- [Verification](docs/verification.md)
- [File Reference](docs/file-reference.md)
- [Terraform Module Layout](infra/README.md)

`apps/portfolio` contains the UI, `services/portfolio` the API/migrations, `packages` local contracts and observability, and `deploy`, `ops`, `infra`, `ci`, and `tests` contain this project's deployment/support assets. DailyPick may appear as portfolio case-study content; that does not create a runtime dependency on its code.
