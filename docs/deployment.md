# Portfolio Deployment

Run all build/operations commands from this project root. There is no dependency on another checkout. The root Jenkinsfile belongs to the future portfolio repository; configure SCM credentials and replace every `REPLACE_ME` repository URL in `deploy/argocd/portfolio.yaml` first.

## Images and CI

Build the API with `docker build --target runtime -t portfolio-api .` (or `--target test` for the CI integration image) and the web image with `docker build -f apps/portfolio/Dockerfile -t portfolio-web .`. Both build contexts are this directory. Bootstrap the controller as a rootful Podman Quadlet on port `127.0.0.1:8082` with `sudo bash scripts/bootstrap-jenkins.sh --apply`, and register the unprivileged inbound builder with `ci/jenkins/bootstrap-rootless-agent.sh --apply` (label `portfolio-rootless-builder`). Run privileged bootstrap commands yourself after review; never send credentials through chat. Every build runs npm tests/build/lint/`format:check`, Helm and Terraform checks, temporary file-backed SQLite integration and strict `npm audit` plus Trivy gates. Main builds publish immutable SHA tags, resolve digests, sign/attest and verify artifacts, and open an `automation/portfolio-*` PR updating `deploy/gitops/portfolio/images.yaml`; they never push directly to main. Jenkins credential IDs are `portfolio-registry-push`, `gitops-push`, `cosign-signing-key`, `cosign-key-password` and `cosign-public-key`.

## Database and Storage

The API uses [SQLite](sqlite.md) at `/var/lib/portfolio/database/portfolio.sqlite` on the retained `portfolio-database` PVC. A migration init container mounts the same volume, records checksums and seeds only missing content. The API is always one replica with a `Recreate` strategy; web replicas may scale separately. No database server, namespace, network port or database credentials are required. Create `portfolio-runtime` with `PORTFOLIO_SESSION_SECRET`, `PORTFOLIO_ADMIN_USERNAME`, `PORTFOLIO_ADMIN_PASSWORD_HASH` and optional editor credentials, or enable `externalSecrets.enabled` and configure `externalSecrets.runtimeKey`. Remove old connection URL keys from either secret source. Follow [Studio Setup](portfolio.md) to generate hashes privately. For an existing installation, complete the offline transfer in [SQLite Storage](sqlite.md) before the first rollout; a fresh volume otherwise starts with seed content.

The chart supports an opt-in private S3-compatible media bucket using `media.s3Bucket`, `media.s3Region` and `media.s3Prefix`; use `media.s3Endpoint` only for an S3-compatible service. Without S3, uploads use the retained `portfolio-media` PVC. With S3, the chart allows HTTPS and IMDSv2 egress for node IAM credentials. Provision a prefix-scoped policy using `infra/aws-media` for an existing host; never put access keys in Helm values. Keep bucket public access blocked, require TLS and enable encryption/versioning. Stable `/media/...` URLs proxy object reads. Run `npm run portfolio:media:migrate` for a dry run, then add `-- --apply` from a process with access to local media and the bucket. Keep originals and verify images before changing backup policy. Back up SQLite with its online backup API or with all writers stopped; copying only the main file during WAL writes is unsafe. Keep backups off-node. The chart uses restricted Pod Security, read-only container root filesystems and secure cookies behind Traefik/Nginx.

## Rollout

1. Prepare k3s/Traefik, Helm, the application namespace, private registry access and reliable local persistent storage. Optional platform/Terraform helpers create no cloud resources unless explicitly applied.
2. Configure runtime/admin secrets, TLS and image references. Preview the native bootstrap with `bash ops/native/bootstrap-platform.sh`; use `--apply` only on a reviewed server.
3. Configure the repository URL and apply `deploy/argocd/portfolio.yaml` only after images, storage, data transfer and secrets are ready. Migrations run in the API init container, not a separate pre-sync Job.
4. Verify readiness, project pages, language switch, contact form, admin login, draft privacy, content conflicts, uploads and persistent restart behavior.
5. Test off-node backup/restore and database rollback before relying on the service.

See [DNS/HTTPS](domain-pavietnam.md), [Capacity](ec2-sizing.md), [Operations](runbooks/incidents.md), and [Verification](verification.md). No infrastructure, DNS, credentials, or Git repository was provisioned during the project split.
