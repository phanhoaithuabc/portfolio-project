# Personal Portfolio

Standalone React/Vite portfolio and Express/SQLite content studio. This repository owns its frontend, API, persistent storage, CI and deployment tooling; no other application is required.

## Features

English/Vietnamese content, structured case studies, custom pages, project layouts, SEO/Open Graph metadata, sitemap, search/categories, contact form/inbox, owner/editor sessions, draft preview, revision history/restore, project JSON import/export, protected project links, cookieless aggregate analytics, and image uploads with reference-aware deletion are included. See [Studio and Administrator Setup](docs/portfolio.md) for privacy, retention and access details.

## Local Development

Run all commands from this directory. Requires Node.js 24 LTS.

```sh
npm ci
npm run portfolio:migrate
npm run dev
```

Open http://127.0.0.1:5174/. The API listens on loopback port 4010. SQLite stores content, sessions, revisions, contacts, project passwords and analytics in `data/portfolio.sqlite`. Configure a random session secret of at least 32 characters in the ignored `.env.portfolio` file before starting. Administrator login remains disabled until you configure your own bcrypt password hash. No default credentials are provided.

Set `PORTFOLIO_DATABASE_FILE` to change the database path. No database server, URL or password is required. `npm run portfolio:preview` remains an explicit development-only JSON preview with temporary sessions. For containers, set your runtime credentials and run `docker compose up --build`; Compose initializes SQLite on a named volume. See [Studio Setup](docs/portfolio.md) and [SQLite Storage and Migration](docs/sqlite.md).

## Validate

```sh
npm test
npm run build
npm run lint -w @portfolio/web
npm run format:check
node scripts/validate-project.mjs
node scripts/validate-deployments.mjs
node ci/validate-sqlite.mjs
```

Helm is required for chart checks. SQLite integration tests use temporary databases and always run; no external database or test URL is required.

## Deployment

The root Dockerfile builds the portfolio API image; `apps/portfolio/Dockerfile` builds the frontend. The root Jenkinsfile tests/publishes these images and promotes only the local portfolio GitOps values. Set the future repository URL in `deploy/argocd/portfolio.yaml` before using Argo CD; its `REPLACE_ME` value deliberately prevents deploying the previous combined repository. No GitHub repository, infrastructure, DNS, or live credentials are created by this split.

Keep the media PVC, database, runtime secrets, administrator credentials, and backups independent of other applications. Optional Terraform/platform tooling is local to this project and never needs a sibling checkout. Its cloud roots compose local network/compute modules and retain state-migration declarations; see [Terraform layout](infra/README.md). A single host is not high availability.

## Documentation

- [Architecture](docs/architecture.md)
- [Studio and Administrator Setup](docs/portfolio.md)
- [Deployment and CI](docs/deployment.md)
- [SQLite Storage and Migration](docs/sqlite.md)
- [DNS and HTTPS](docs/domain-pavietnam.md)
- [Capacity](docs/ec2-sizing.md)
- [Observability](docs/observability.md)
- [Incident Runbook](docs/runbooks/incidents.md)
- [Verification](docs/verification.md)
- [File Reference](docs/file-reference.md)
- [Terraform Module Layout](infra/README.md)

`apps/portfolio` contains the UI, `services/portfolio` the API/migrations, `packages` local contracts and observability, and `deploy`, `ops`, `infra`, `ci`, and `tests` contain this project's deployment/support assets.
