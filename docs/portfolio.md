# Personal Portfolio and Content Studio

## Standalone Project

This project owns the portfolio frontend, API, database, media, tests, CI and deployment files. It does not import or deploy another application. Use [Architecture](architecture.md), [Deployment](deployment.md), [SQLite Storage](sqlite.md) and [DNS/HTTPS](domain-pavietnam.md). All commands run from this project root.

## Public Site and Admin

The public page includes your introduction, project search/categories, featured work, case studies, technology list and a contact form. Visitors can switch between English and Vietnamese; untranslated text falls back to English. A Personal Portfolio case study is seeded as the first project. No invented employer, certification, years of experience, contact address or GitHub account is included. Starter biography/role copy is editable; review it before publishing. Published projects have direct `/projects/<slug>` pages with canonical/Open Graph metadata, and `/sitemap.xml` lists published project pages.

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

Open `http://127.0.0.1:5174/`. Portfolio API uses loopback port 4010. Vite selects another port if 5174 is occupied, but the admin's exact public origin must be configured to match the URL actually used. Normal development uses SQLite: configure your session secret, run `npm run portfolio:migrate`, then `npm run dev`. The preview command above explicitly selects JSON storage instead.

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

## SQLite Runtime

Normal runtime uses SQLite through Node.js 24's built-in `node:sqlite` module. Set `PORTFOLIO_DATABASE_FILE` (default `data/portfolio.sqlite`) and a stable session secret, then run:

```sh
npm run portfolio:migrate
npm run dev
```

Migrations create content, sessions, revisions, contacts, project password and analytics tables. Content is a JSON text document with an atomic revision. Immediate transactions preserve revision history and reject stale edits. Sessions persist across restarts and expire after eight hours; expired rows are pruned on session reads/writes. Migrations seed only a missing document and never overwrite edited content.

There is no database connection URL, network service, database user or connection pool. Existing connection URL settings must be removed. Use [SQLite Storage](sqlite.md) for existing-data transfer, backup/restore and filesystem requirements.

## Kubernetes Deployment

1. Prepare k3s/Traefik and the `portfolio` namespace. Review [capacity](ec2-sizing.md) and reliable local persistent storage.
2. Create `portfolio-runtime` with `PORTFOLIO_SESSION_SECRET`, `PORTFOLIO_ADMIN_USERNAME`, `PORTFOLIO_ADMIN_PASSWORD_HASH` and optional editor credentials, or configure External Secrets. Do not include an old database URL.
3. Build/publish the API and web images and configure immutable image references under `deploy/gitops/portfolio`.
4. Configure repository URLs in `deploy/argocd/portfolio.yaml`, review the diff, then apply it. The API's init container migrates its mounted database before startup.
5. Configure [DNS/HTTPS](domain-pavietnam.md), then verify the public site, admin login, drafts, contact form, media, revision conflicts and persistence after restart.

The API always uses one replica and `Recreate`, with a retained 2-GiB `portfolio-database` PVC. This prevents overlapping API instances during updates and causes brief downtime. The separate media PVC is retained too. `replicas` changes only the web tier. No separate database namespace or server is deployed. Keep off-node backups and test restore before production use.

Production uses HTTPS and host-only, HttpOnly, SameSite Strict cookies. Unsafe admin requests require an exact origin and session CSRF token. The chart trusts two proxy hops (Traefik then Nginx); direct local development trusts none. Set `PORTFOLIO_TRUST_PROXY_HOPS` to the actual known count (0, 1 or 2) if topology changes. Never trust arbitrary forwarded headers on an exposed API port. Cloud firewall changes must be reviewed separately.

## Delivery and Operations

The root Jenkinsfile runs tests, typechecking, build, frontend lint, formatting, Helm/Terraform validation, file-backed SQLite integration and security scans. Main builds publish digest-pinned images, sign/attest and verify artifacts, then open a reviewed GitOps promotion PR. See [Deployment](deployment.md) for controller/agent setup and credential IDs. Nothing is committed, pushed or deployed by a local validation run.

The API exposes `/health`, database-dependent `/ready` and `/metrics`. Monitor SQLite disk/WAL growth, backup success and media capacity as well as request metrics. Single-host storage is not high availability. Use [Verification](verification.md), [SQLite Storage](sqlite.md), [Incident Runbook](runbooks/incidents.md) and the generated [File Reference](file-reference.md) for focused checks and source ownership.
