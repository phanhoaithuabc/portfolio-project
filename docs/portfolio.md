# Personal Portfolio and Content Studio

## Standalone Project

This project owns the portfolio frontend, API, database, media, tests, CI and deployment files. It does not import or deploy another application. Use [Architecture](architecture.md), [Deployment](deployment.md), [Native PostgreSQL](native-postgres.md) and [DNS/HTTPS](domain-pavietnam.md). All commands run from this project root.

## Public Site and Admin

The public page includes your introduction, project search/categories, featured work, case studies, technology list and a contact form. Visitors can switch between English and Vietnamese; untranslated text falls back to English. DailyPick is seeded as the first published project, with a screenshot of the running storefront. No invented employer, certification, years of experience, contact address or GitHub account is included. Starter biography/role copy is editable; review it before publishing. Published projects have direct `/projects/<slug>` pages with canonical/Open Graph metadata, and `/sitemap.xml` lists published project pages.

`/admin` opens the private portfolio studio. You can edit your name, role, headline, introduction, biography, location, contact email, GitHub/LinkedIn/resume links, hero image and skills, with Vietnamese translations. Projects support title, category, year, slug, summary, legacy case-study text, cover image, live/repository URLs, technologies, order, featured status, draft/published status, localized copy, SEO title/description and image alt text. New ordered case-study blocks support rich text, images, galleries, YouTube/Vimeo embeds and outcome metrics; existing description-only projects continue to render until blocks are added. Project blocks and custom pages support Vietnamese headings/captions/text. Add/delete operations and all field edits are saved together through **Save changes**.

Owners can add/reorder/publish custom pages from the Pages tab, choose the editorial or balanced project grid, and preview unpublished pages. Published pages have `/pages/<slug>` SSR routes, canonical/Open Graph metadata and sitemap entries. Per-project visibility can be public/listed, unlisted/direct-link only, or password protected. Private projects are excluded from public feeds/sitemaps, emit `noindex`, and use bcrypt password hashes stored separately from exported content. Access cookies are signed, scoped to one project, expire after eight hours, and are revoked when its password changes. A private project cannot be saved in password mode until its owner has set a password.

Single-project JSON export/import is available in Projects. Import validates the project schema, assigns a new ID/slug, forces draft/public visibility, and never imports a password. It is the practical cross-platform transfer path; no Behance/Lightroom sync is connected. Draft projects never appear in public API responses; signed-in editors can edit and preview draft project content, while only the owner can publish, manage pages, change access policy or use owner tools.

External profile links accept HTTPS or local static-asset paths. Content is rendered as text rather than raw HTML. Native form checks and server validation reject malformed links, duplicate project IDs/slugs and oversized input. Concurrent edits receive `409` instead of overwriting newer content. Public API responses have a 30-second cache allowance; the frontend explicitly fetches without browser cache when loading the site.

Owner tools include revision history and restore, JSON content export/import, a contact-message inbox with status updates, media upload/list/delete, and privacy-conscious analytics. Analytics aggregates daily page views, outbound clicks and successful contact submissions by normalized referrer hostname. The collector does not store IP addresses, cookies, user IDs, user agents or full referrer URLs; it respects DNT/GPC and the public-site opt-out toggle, and deletes aggregates older than 400 days. Rate limiting uses transient middleware counters, not the analytics database. Password hashes are kept separate from content revisions/exports; retaining them by project ID allows restoration of a private revision. Delete a project's password explicitly when it should no longer be recoverable.

Uploads accept PNG, JPEG, GIF and WebP files up to 8 MiB; uploaded files use generated names and cannot be deleted while referenced by profile or project content. Gallery media uses the same library paths. The project-page CSP only allows YouTube Privacy Enhanced Mode and Vimeo frames; other video URLs are shown as safe outbound links. Production media can use a private S3 bucket via `media.s3Bucket`, `media.s3Region` and `media.s3Prefix` in Helm; the API keeps stable `/media/...` URLs and proxies object reads. Use bucket-level encryption, versioning, public-access blocks, TLS-only policy and workload IAM rather than static keys. The 2-GiB `ReadWriteOnce` media PVC remains mounted during cutover and is used by local preview or when S3 is not configured. Copy its contents with `npm run portfolio:media:migrate` first without flags to preview, then with `--apply`; originals are retained. Contact submissions are validated, rate-limited and honeypot-checked before entering the private inbox.

## Local Preview

Requires Node.js 24 LTS and the workspace dependencies:

```sh
npm ci
npm run portfolio:preview
```

Open `http://127.0.0.1:5174/`. DailyPick remains independently available on its existing port, normally 5173. Portfolio API uses loopback port 4010. Vite selects another port if 5174 is occupied, but the admin's exact public origin must be configured to match the URL actually used.

Preview mode is explicit: it uses the ignored `data/portfolio.json` file and temporary in-memory sessions. It binds the API to loopback and refuses `NODE_ENV=production`. Restarts retain content, not sessions. This is not the Kubernetes data store and must not be scaled across processes. The session secret is generated afresh at startup if no preview secret is supplied. Admin sign-in is **disabled** until you configure your own password hash; there is no default password or authentication bypass.

## Configure Your Administrator

Use a password manager and a unique passphrase. `portfolio:hash-password` uses bcrypt cost 12 and reads only the `PORTFOLIO_ADMIN_PASSWORD` process variable; it does not accept a password as a command-line argument. The password must be at least 12 characters and no more than 72 UTF-8 bytes. Do not paste a real password, hash, database URL or session secret into chat.

In your own Bash/Zsh terminal:

```sh
read -rs 'PORTFOLIO_ADMIN_PASSWORD?Choose an administrator password: '
echo
export PORTFOLIO_ADMIN_PASSWORD
npm run portfolio:hash-password
unset PORTFOLIO_ADMIN_PASSWORD
```

The `name?prompt` form above is for Zsh (the current project terminal). Bash users can use `read -rs -p 'Choose an administrator password: ' PORTFOLIO_ADMIN_PASSWORD` instead. The hash is printed in your terminal; the password is not. Windows PowerShell can use a masked prompt:

```powershell
$password = Read-Host "Choose an administrator password" -AsSecureString
$pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($password)
try {
  $env:PORTFOLIO_ADMIN_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
  npm run portfolio:hash-password
} finally {
  Remove-Item Env:PORTFOLIO_ADMIN_PASSWORD -ErrorAction SilentlyContinue
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
}
```

Put the resulting bcrypt hash and a CSPRNG-generated session secret of at least 32 characters in the ignored `.env.portfolio` file using your own editor/password manager. Node's env-file parser preserves `$` in hashes; do not accidentally shell-expand a hash. Do not store the plaintext password there.

```dotenv
PORTFOLIO_ADMIN_USERNAME=admin
PORTFOLIO_ADMIN_PASSWORD_HASH=YOUR_BCRYPT_HASH
PORTFOLIO_SESSION_SECRET=YOUR_LONG_RANDOM_SECRET
PORTFOLIO_PUBLIC_ORIGIN=http://127.0.0.1:5174
# Optional second account; generate its hash with the same command.
PORTFOLIO_EDITOR_USERNAME=editor
PORTFOLIO_EDITOR_PASSWORD_HASH=YOUR_EDITOR_BCRYPT_HASH
```

Restart the preview after configuration changes, then open `/admin`. Configure both editor variables or neither; editors can update and preview drafts, while publishing, media, inbox, import/export and revision restore remain owner-only. There is no public registration or password-reset email endpoint. Rotate hashes through your secret-management process. Rotate the session secret as well when existing sessions must be invalidated. Database session expiry is eight hours. A password change by itself does not revoke an already signed-in session.

## PostgreSQL Runtime

This section is the **legacy pod-database path**, not the selected native EC2 setup. For native credentials, chart activation and migration, use [Native PostgreSQL](native-postgres.md). Do not apply the commands below to a fresh native installation.

Use the dedicated PostgreSQL instance deployed from `deploy/helm/portfolio-db` in `portfolio-data`. Do not create the portfolio database on DailyPick's PostgreSQL instance. Prepare a distinct `portfolio-postgres` Secret in `portfolio-data` with `POSTGRES_USER=portfolio_bootstrap` and a unique `POSTGRES_PASSWORD`, using an ignored operator-managed file or secret manager. The image creates the initial `portfolio` database on its new PVC; do not use that bootstrap superuser as the application role.

```sh
kubectl create namespace portfolio-data
kubectl -n portfolio-data create secret generic portfolio-postgres --from-env-file=.env.portfolio-postgres
helm upgrade --install portfolio-db deploy/helm/portfolio-db -n portfolio-data --wait --timeout 5m
kubectl -n portfolio-data exec -it portfolio-postgres-0 -- psql -U portfolio_bootstrap -d portfolio
```

On this dedicated instance, create the runtime role in a trusted operator terminal:

```sql
CREATE ROLE portfolio_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE;
\password portfolio_app
ALTER DATABASE portfolio OWNER TO portfolio_app;
REVOKE CONNECT ON DATABASE portfolio FROM PUBLIC;
GRANT CONNECT ON DATABASE portfolio TO portfolio_app;
```

`\password` securely prompts in psql. URL-encode the password before constructing a connection URI. The Kubernetes URI must use `postgres.portfolio-data.svc.cluster.local:5432/portfolio`, not `postgres.data.svc.cluster.local`. The API and migration both enforce that expected hostname and reject a Secret pointing at the DailyPick host. `PORTFOLIO_EXPECTED_DATABASE_HOST` is set by the chart. Local development may use a separate PostgreSQL instance exposed on another loopback port, such as 5433; configure its URL and run `npm run portfolio:migrate` before `npm run portfolio:dev`. File preview mode remains an explicit development-only option.

| Application | PostgreSQL host                                  | Process                               | Persistent storage                  |
| ----------- | ------------------------------------------------ | ------------------------------------- | ----------------------------------- |
| DailyPick   | `postgres.data.svc.cluster.local:5432`           | `data/postgres-0`                     | DailyPick's existing PostgreSQL PVC |
| Portfolio   | `postgres.portfolio-data.svc.cluster.local:5432` | `portfolio-data/portfolio-postgres-0` | New independent 5-GiB PVC           |

If the portfolio already has data in the old shared PostgreSQL instance, take an off-node backup, pause portfolio writers, restore its content/session tables into the dedicated instance, verify ownership and content revisions, then update `portfolio-runtime` and roll out. Do not delete the old database/volume until the restore has been verified. This change does not move or destroy live data automatically. If you mean physically different servers, use another VM or managed database instead; that is outside the one-EC2 design.

Migrations create `portfolio_content` (one validated JSONB document plus an atomic revision), `portfolio_sessions`, `portfolio_content_versions`, `portfolio_contact_messages`, separate project password hashes, and daily analytics aggregates. Migration `003_private_projects_analytics.sql` adds the last two tables. They seed only a missing document and never overwrite an edited profile. Profile/projects/pages belong to one small authoring aggregate, so a single optimistic revision is simpler than cross-table partial saves. The sessions table is separate and periodically pruned. The API uses a three-connection pool shared with the session store.

Run `node ci/validate-database-hosts.mjs` with Helm installed to verify rendered hostnames, selectors, PVC separation and network boundaries. The portfolio pipeline now runs that check as well as chart linting. This proves configuration intent; after deployment, confirm that Service endpoints resolve to different PostgreSQL pods and that cross-namespace connections are denied.

## Same-Server Kubernetes Deployment

1. Keep the existing Terraform VM/k3s platform. Check available CPU/memory/disk before adding the portfolio. The web/API request 50m CPU and 160 MiB; the separate PostgreSQL adds 100m CPU, 256 MiB and a 5-GiB PVC. Actual use and build peaks are higher. See [EC2 Sizing and Software](ec2-sizing.md).
2. Create the `portfolio` application namespace and the `portfolio-data` database namespace. Install the dedicated PostgreSQL chart and create its runtime role as above. Do not label `portfolio` as allowed to access the DailyPick data platform; the separate database policy allows only `portfolio-api` pods from `portfolio`. If an older deployment added `dailypick.io/application=true` to `portfolio`, remove that label to revoke the old shared-data access.
3. Create a `portfolio-runtime` Secret in `portfolio` with `PORTFOLIO_DATABASE_URL`, `PORTFOLIO_SESSION_SECRET`, `PORTFOLIO_ADMIN_USERNAME` and `PORTFOLIO_ADMIN_PASSWORD_HASH`; optionally add both editor variables. Use an ignored local env file or a secret manager, never committed values. The URI host is `postgres.portfolio-data.svc.cluster.local:5432/portfolio`.
4. Build/publish the two portfolio images. Set the registry paths/tag in `deploy/gitops/portfolio/images.yaml`. Configure an image-pull Secret if the registry is private.
5. Configure your Git repository URLs in `deploy/argocd/portfolio.yaml`. This contains a separate, namespace-restricted AppProject and Application. Apply it only after prerequisites are ready. Argo's PreSync job runs the portfolio migration before rollout.
6. Follow [P.A Vietnam DNS / HTTPS](domain-pavietnam.md) to create the `portfolio-tls` certificate for `phanhoaithu.io.vn`. DailyPick's `dailypick-tls` Secret must cover `dailypick.phanhoaithu.io.vn` in its own namespace. Certificate Secrets are namespaced; one Secret cannot be referenced across namespaces.
7. Point both DNS A records to the VM's public IP. Configure AAAA only if the server/firewall actually supports IPv6. Avoid wildcard ingress rules that accidentally route unrelated hosts. Root portfolio and DailyPick ingress hostnames do not conflict.

```sh
kubectl create namespace portfolio
# Remove an old shared-data access label if present:
kubectl label namespace portfolio dailypick.io/application- --overwrite
# Create the Secret from an ignored, operator-managed env file:
kubectl -n portfolio create secret generic portfolio-runtime --from-env-file=.env.portfolio.production
kubectl apply -f deploy/argocd/portfolio.yaml
```

`.env.portfolio.production` must contain production database/credential values, not local preview settings. `NODE_ENV=production`, PostgreSQL mode, HTTPS origin and secure cookies are enforced by the chart. Administrator cookies are host-only, HttpOnly and SameSite Strict; they are not shared with the DailyPick subdomain. Every unsafe admin request also needs an exact-origin match and session CSRF token. Login regenerates the session and is rate-limited; changing TLS/origin values incorrectly fails closed.

The cloud firewall still defaults web traffic to the trusted administrator CIDR. Opening 80/443 to the Internet affects both hostnames on that VM. Review DailyPick's test-payment/demo security before doing so, and add a per-host allowlist/authentication policy if DailyPick must stay private. No firewall or DNS change is applied by adding the portfolio files.

The chart trusts exactly two proxy hops (Traefik then Nginx) for secure cookies and client-IP login limits. Direct local preview trusts none. If you change that network topology, set `PORTFOLIO_TRUST_PROXY_HOPS` to the actual known count (0, 1, or 2), keep ingress forwarded-header trust restricted, and review the NetworkPolicy. Do not trust arbitrary proxy headers on an externally reachable API port.

## Delivery Pipeline

Bootstrap the zero-executor controller (`sudo bash scripts/bootstrap-jenkins.sh --apply`, port `127.0.0.1:8082`) and the unprivileged rootless Podman agent (`ci/jenkins/bootstrap-rootless-agent.sh --apply`, label `portfolio-rootless-builder`). Configure `IMAGE_PREFIX`, `portfolio-registry-push`, `gitops-push`, `cosign-signing-key`, `cosign-key-password` and `cosign-public-key` in Jenkins. Every build runs typechecking, unit tests, `format:check`, Helm/Terraform validation, multi-stage test/runtime image builds, disposable PostgreSQL integration against the `--target test` image, and strict `npm audit`/Trivy gates without `--ignore-unfixed`. Only builds on `main` push images, resolve immutable manifest digests, attach and verify Cosign signatures plus CycloneDX SBOM and SLSA provenance attestations, and open a reviewed `automation/portfolio-*` PR updating `deploy/gitops/portfolio/images.yaml` (protected by `.github/CODEOWNERS`).

Argo deploys the portfolio independently of DailyPick. No automatic commit, push or deployment was performed while building this feature.

## Source Reference

| Path                                                      | Responsibility                                                                                               |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `apps/portfolio/src/public/PublicSite.tsx`                | Public identity, project filtering, case studies, about and contact sections                                 |
| `apps/portfolio/src/admin/AdminPage.tsx`                  | Login, profile/project authoring, draft/publish/delete controls and save/conflict states                     |
| `apps/portfolio/src/admin/Fields.tsx`                     | Reusable labeled text/textarea fields                                                                        |
| `apps/portfolio/src/components/Modal.tsx`                 | Accessible case-study/delete dialogs                                                                         |
| `apps/portfolio/src/lib/api.ts`                           | Same-origin API client, CSRF headers, no-cache reads and typed errors                                        |
| `apps/portfolio/src/styles.css`, `src/admin/admin.css`    | Public/editor responsive design                                                                              |
| `apps/portfolio/public/dailypick-preview.png`             | Generated screenshot of the actual DailyPick storefront                                                      |
| `apps/portfolio/Dockerfile`, `nginx.conf`                 | Unprivileged web image, HTTPS forwarding, security policy and portfolio API proxy                            |
| `services/portfolio/src/app.ts`                           | Public read boundary and protected, validated administrator HTTP routes                                      |
| `services/portfolio/src/content.ts`                       | Initial editable content and repository contract                                                             |
| `services/portfolio/src/postgres.ts`                      | Own database pool and revision-checked JSONB persistence                                                     |
| `services/portfolio/src/database-config.ts`               | Rejects an unexpected database host before opening a pool                                                    |
| `services/portfolio/src/file-repository.ts`               | Explicit single-process local preview persistence, never production fallback                                 |
| `services/portfolio/src/index.ts`                         | Runtime mode, sessions, secure cookies and process lifecycle                                                 |
| `services/portfolio/src/migrate.ts`, `migrations/`        | Ordered, repeatable content, session, revision-history and contact-inbox schema migrations                   |
| `services/portfolio/src/hash-password.ts`                 | Operator-only bcrypt hashing without CLI password arguments                                                  |
| `packages/contracts/src/portfolio.ts`                     | Shared validated content/profile/project contracts                                                           |
| `deploy/helm/portfolio`                                   | Separate deployments, services, ingress, migration hook and network policies                                 |
| `deploy/gitops/portfolio`, `deploy/argocd/portfolio.yaml` | Independent artifact promotion and namespace-restricted reconciliation                                       |
| `Jenkinsfile`, `ci/update-portfolio-images.mjs`           | Portfolio-specific build/test/scan/push/promotion workflow                                                   |
| `tests/portfolio*.ts`                                     | Authentication, CSRF, draft privacy, revision conflicts, file durability and optional PostgreSQL integration |

## Operations and Verification

The portfolio API exposes `/health`, database-dependent `/ready` and `/metrics`. Prometheus discovery now includes the `portfolio` namespace, and the API can export traces to the existing collector. The current FinOps utilization collector's application namespace selector still targets DailyPick; extend its selector/budgets before claiming portfolio-specific chargeback. Do not assume namespace isolation or additional pods provide host high availability.

Back up the portfolio database and `portfolio-media` PVC separately, alongside the existing platform backup plan. Store session secrets/password hashes in an access-controlled secret manager. Use off-node backup storage and test restoring content, uploaded media and credentials. An application image rollback does not roll back user-edited database content. Export or restore content intentionally; migrations preserve it.

Local validation includes API authentication/CSRF/revision tests, preview durability, and a browser workflow against a disposable test backend: sign in, edit profile, add a draft, publish, confirm public visibility and sign out. The test backend was shut down and did not alter real preview content. PostgreSQL integration is opt-in through `TEST_PORTFOLIO_DATABASE_URL` and is skipped without it. Docker image startup, Jenkins/Argo execution, live DNS/TLS and database deployment remain to be verified with your infrastructure. No real administrator password was set automatically.
