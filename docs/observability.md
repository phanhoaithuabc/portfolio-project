# Portfolio Observability

The API exposes `/health`, database-dependent `/ready` and `/metrics`. Structured request logs include route templates/status/duration rather than session tokens or contact-message bodies. The local OpenTelemetry helper can export traces when `OTEL_ENABLED=true`; configure the OTLP collector endpoint in the runtime environment.

The optional observability chart contains Prometheus, Grafana, Jaeger, collector and Alertmanager configurations. Prometheus discovers the portfolio namespace. Keep all administration surfaces private and use SSH tunnels or authenticated access. Existing shared monitoring can be reused by an operator without requiring another application's source tree.

Monitor API latency/errors, readiness, SQLite disk/WAL growth and backup status, media PVC capacity, administrator authentication failures and contact submission limits. Investigate busy-timeout errors before considering more writers. Test alert delivery; an installed Alertmanager with no external receiver does not provide paging. Pods on one host do not provide host-level availability.

See [Capacity](ec2-sizing.md), [Operations](runbooks/incidents.md), and [Verification](verification.md).
