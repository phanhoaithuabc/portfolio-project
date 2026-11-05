# portfolio Capacity

Use one reviewed cloud/environment at a time. Terraform under `infra/aws`, `infra/azure`, and `infra/gcp` is optional and billable when applied. The app can also use an existing server.

Portfolio needs the web/API, a persistent local SQLite volume and durable uploaded-media storage. It does not require a separate database server, event broker or search service. Helm defaults to a 2-GiB database PVC and a 2-GiB media PVC; measure data growth and provision room for WAL files and backups.

Jenkins builds and dependency/image scans can use more CPU/RAM than idle workloads. Measure peak usage, disk growth, PVC demand and SQLite write latency; requests are not measured load benchmarks. Observability and Argo CD add overhead. If using a shared host, aggregate all workloads without granting this project ownership over another app. A single VM is not high availability; keep off-node backups.
