# portfolio Incident Runbook

1. Check recent GitOps promotions, pod events and probes: `kubectl -n portfolio get pods,events`.
2. Check `portfolio-database` PVC binding/mount permissions, free disk space, migration init-container logs and `PORTFOLIO_DATABASE_FILE`. Keep one API writer; do not delete SQLite WAL/SHM files while the database is open. Never print secrets into tickets/chat.
3. Inspect structured logs and request metrics without copying customer/session data. Check the media PVC, content revisions and administrator session configuration.
4. Roll application images back through a reviewed GitOps promotion. Image rollback does not revert database content/migrations.
5. Restore only from a verified off-node backup while writers are stopped; retain the old source and test a rollback.

A pod restart does not fix a full disk or unavailable host. See [SQLite Storage](../sqlite.md) and [Verification](../verification.md).
