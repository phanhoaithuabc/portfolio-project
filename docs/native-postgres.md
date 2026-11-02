# portfolio Native PostgreSQL

This project configures only its own PostgreSQL 17 cluster on Ubuntu 24.04. It does not need a sibling checkout. Database: `portfolio`, systemd unit: `postgresql@17-portfolio`, port: `5433`.

## Fresh Host

Review the installer before running privileged commands. Preview with `bash ops/native/bootstrap-platform.sh`; explicitly use `--apply` in your own administrator terminal to provision it. Existing unmanaged databases are never replaced. Set `nativeDatabase.enabled: true`, `nativeDatabase.address` to the server private IPv4, and `nativeDatabase.port: 5433` in `deploy/gitops/portfolio/values.yaml`. The chart creates a selectorless Service/EndpointSlice; PostgreSQL stays outside Kubernetes.

## Existing Data

Do not treat bootstrap as migration. Take an off-node `pg_dump -Fc`, pause all writers, restore to a separately verified target with `pg_restore --exit-on-error`, compare records and permissions, then update the runtime database Secret. Keep the source database/PVC until restore and rollback are tested. Never run old and new copies with writes enabled simultaneously. Secret updates require restarting application pods.

Back up the database, runtime secrets, and portfolio-media volume. The server and disk are one failure domain. See [Deployment](deployment.md), [Operations](runbooks/incidents.md), and [Verification](verification.md).
