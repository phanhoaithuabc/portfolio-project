# portfolio Capacity

Use one reviewed cloud/environment at a time. Terraform under `infra/aws`, `infra/azure`, and `infra/gcp` is optional and billable when applied. The app can also use an existing server.

Portfolio needs the web/API, its PostgreSQL database and durable uploaded-media storage. It does not need Kafka, Elasticsearch, Stripe or DailyPick services.

Jenkins builds and dependency/image scans can use more CPU/RAM than idle workloads. Measure peak usage, disk growth, PVC demand and database connections; requests are not measured load benchmarks. Observability and Argo CD add overhead. If using a shared host, aggregate all workloads without granting this project ownership over another app. A single VM is not high availability.
