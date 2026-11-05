# SQLite Storage and Migration

## Runtime

Requires Node.js 24 or newer. The API uses the built-in `node:sqlite` engine; some Node versions emit an experimental-feature warning. Set `PORTFOLIO_DATABASE_FILE` to a writable local file, default `data/portfolio.sqlite`. Configure a persistent session secret (at least 32 characters). Run `npm run portfolio:migrate` before `npm run dev`. Migrations are checksum-checked, transactional and seed only missing content. Do not edit applied migrations.

Content, revision history, contacts, project password hashes, analytics and expiring sessions share this file. WAL mode and `synchronous=FULL` are enabled. The database directory must be writable for the database, `-wal` and `-shm` sidecars. Keep the directory private and outside the web root. No database URL, network port or database credentials are needed. JSON preview remains development-only.

Kubernetes mounts the retained `portfolio-database` PVC at `/var/lib/portfolio/database`. A migration init container runs before the API using the same volume and image. The API is always one replica with `Recreate`; upgrades briefly interrupt service. `replicas` scales only the web tier. Use storage with reliable local locking, not NFS. Local-path storage ties the database to its node; additional pods do not provide host failover.

## Transfer Existing Data

No live database is automatically changed. For an existing PostgreSQL deployment:

1. Take a verified off-node backup and stop all old application writers. Keep the source database and media intact for rollback.
2. Export a consistent JSON snapshot using the supplied SQL in a trusted operator terminal. Use your existing secure psql connection configuration, not a password on the command line:

   ```sh
   psql -X -qAt -v ON_ERROR_STOP=1 -f ops/export-portfolio-snapshot.sql -o backups/portfolio-snapshot.json
   ```

3. Set `PORTFOLIO_DATABASE_FILE` to a **new, empty** destination in your operator environment or ignored `.env.portfolio`, then run `npm run portfolio:import -- backups/portfolio-snapshot.json`. Do not run `portfolio:migrate` first: it seeds content, and the importer intentionally refuses any populated target. The importer creates the schema itself, validates the snapshot and commits all rows atomically. Existing targets are never overwritten.
4. Compare the reported revision/table counts with the source. Verify profile/translations, revision restore, contacts, project passwords and analytics. Copy and verify uploaded media separately. Existing sessions are deliberately not imported; sign in again.
5. Before Kubernetes rollout, populate the database PVC with the imported database while the API is stopped, preserving UID/GID 1000 ownership. Keep the old API scaled to zero. Remove obsolete `PORTFOLIO_DATABASE_URL` and `PORTFOLIO_EXPECTED_DATABASE_HOST` keys from the runtime Secret or external secret source; the runtime rejects old connection URLs rather than silently opening a blank database. The chart sets the new file path explicitly.
6. Deploy and verify persistence after restart before retiring any source. Roll back only with writers stopped and an explicit plan for edits made after transfer. Never allow old and new copies to accept writes together.

The import preserves existing authored content, including project names; review unwanted sample content in the studio instead of blindly rewriting user records. Protect the snapshot like a database backup: it includes private messages and password hashes. An admin content export transfers only the content document, not contacts, historical revisions, passwords or analytics.

## Backup and Restore

Use SQLite's online backup API (Node `backup` from `node:sqlite`) or the SQLite CLI `.backup` command when writers are running. Do not copy just the main file during WAL writes. Alternatively, stop the API cleanly and back up the entire database directory. Store backups encrypted off-node, alongside separately protected runtime secrets and uploaded media; S3 media uses its own versioning/backup policy.

Restore into a separate file first, run `PRAGMA integrity_check`, compare revisions and record counts, and test the application before switching paths or replacing a stopped volume. Keep the previous database until rollback has been verified. Application image rollback does not revert edited content or schema changes.

See [Deployment](deployment.md), [Operations](runbooks/incidents.md) and [Verification](verification.md).
