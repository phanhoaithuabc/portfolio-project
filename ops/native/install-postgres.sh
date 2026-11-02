#!/usr/bin/env bash
set -euo pipefail
umask 077

if [[ "${EUID}" -ne 0 ]]; then echo "Run this installer as the EC2 administrator with sudo in your own terminal." >&2; exit 1; fi
if [[ "${1:-}" != "--apply" ]]; then echo "Dry-run: installs native PostgreSQL 17; creates only portfolio:5433, private listeners and root-only connection files. Use --apply after reviewing docs/native-postgres.md. Existing unmanaged clusters are never replaced."; exit 0; fi
source /etc/os-release
if [[ "${ID}" != ubuntu || "${VERSION_ID}" != 24.04 ]]; then echo "This installer targets Ubuntu 24.04 only." >&2; exit 1; fi
if command -v pg_lsclusters >/dev/null 2>&1; then
  while read -r version name _rest; do
    if [[ "$version" != 17 || ("$name" != dailypick && "$name" != portfolio) || ! -f "/etc/site-platform/${name}.managed" ]]; then echo "Unmanaged PostgreSQL cluster detected. Back up/migrate explicitly; refusing installation." >&2; exit 1; fi
  done < <(pg_lsclusters --no-header)
fi
token="$(curl -fsS --connect-timeout 3 -X PUT -H 'X-aws-ec2-metadata-token-ttl-seconds: 60' http://169.254.169.254/latest/api/token)"
private_ip="$(curl -fsS --connect-timeout 3 -H "X-aws-ec2-metadata-token: $token" http://169.254.169.254/latest/meta-data/local-ipv4)"
if [[ ! "$private_ip" =~ ^10\.20\.1\.[0-9]{1,3}$ ]]; then echo "Expected the repository's 10.20.1.0/24 private subnet. Review the installer before using another network." >&2; exit 1; fi
export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y --no-install-recommends postgresql-common ca-certificates curl openssl
if ! grep -Eq '^create_main_cluster[[:space:]]*=[[:space:]]*false' /etc/postgresql-common/createcluster.conf; then printf '\ncreate_main_cluster = false\n' >> /etc/postgresql-common/createcluster.conf; fi
install -d -m 0755 /usr/share/postgresql-common/pgdg
curl -fsS https://www.postgresql.org/media/keys/ACCC4CF8.asc -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc
chmod 0644 /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc
printf 'deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt noble-pgdg main\n' > /etc/apt/sources.list.d/pgdg.list
apt-get update
apt-get install -y --no-install-recommends postgresql-17 postgresql-client-17
install -d -m 0700 /etc/site-platform

for site in portfolio; do
  port=5433; namespace=portfolio; shared=64MB
  if ! pg_lsclusters --no-header | awk '{print $1 "/" $2}' | grep -Fxq "17/$site"; then
    if [[ -e "/etc/postgresql/17/$site" || -e "/var/lib/postgresql/17/$site" ]]; then echo "Unmanaged $site directory exists; refusing to overwrite it." >&2; exit 1; fi
    touch "/etc/site-platform/${site}.managed"
    pg_createcluster 17 "$site" --port "$port" --start-conf=auto
  fi
  if [[ ! -f "/etc/site-platform/${site}.managed" ]]; then echo "Missing managed-cluster marker; refusing to alter $site." >&2; exit 1; fi
  configuration="/etc/postgresql/17/$site"
  install -d -o postgres -g postgres -m 0750 "$configuration/conf.d"
  printf "listen_addresses = '127.0.0.1,%s'\nport = %s\nmax_connections = 40\nshared_buffers = '%s'\npassword_encryption = 'scram-sha-256'\nlog_statement = 'none'\n" "$private_ip" "$port" "$shared" > "$configuration/conf.d/site-platform.conf"
  chown postgres:postgres "$configuration/conf.d/site-platform.conf"
  chmod 0640 "$configuration/conf.d/site-platform.conf"
  {
    printf 'local all postgres peer\n'
    printf 'local all all scram-sha-256\n'
    printf 'host %s %s_app 127.0.0.1/32 scram-sha-256\n' "$site" "$site"
    printf 'host %s %s_app 10.42.0.0/16 scram-sha-256\n' "$site" "$site"
    printf 'host %s %s_app %s/32 scram-sha-256\n' "$site" "$site" "$private_ip"
    printf 'host all all 0.0.0.0/0 reject\nhost all all ::/0 reject\n'
  } > "$configuration/pg_hba.conf"
  chown postgres:postgres "$configuration/pg_hba.conf"
  chmod 0640 "$configuration/pg_hba.conf"
  if [[ ! -f "/etc/site-platform/${site}.password" ]]; then openssl rand -hex 32 > "/etc/site-platform/${site}.password"; fi
  password="$(<"/etc/site-platform/${site}.password")"
  if [[ ! "$password" =~ ^[0-9a-f]{64}$ ]]; then echo "Invalid managed password file; refusing to emit SQL." >&2; exit 1; fi
  systemctl enable "postgresql@17-${site}.service"
  systemctl restart "postgresql@17-${site}.service"
  printf "DO \$\$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='%s_app') THEN CREATE ROLE %s_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE PASSWORD '%s'; END IF; END \$\$;\n" "$site" "$site" "$password" | runuser -u postgres -- psql --cluster "17/$site" --dbname postgres --set ON_ERROR_STOP=1 --quiet
  if ! runuser -u postgres -- psql --cluster "17/$site" --dbname postgres --tuples-only --no-align --command "SELECT 1 FROM pg_database WHERE datname='$site'" | grep -Fxq 1; then runuser -u postgres -- createdb --cluster "17/$site" --owner "${site}_app" "$site"; fi
  printf 'REVOKE CONNECT ON DATABASE %s FROM PUBLIC; GRANT CONNECT ON DATABASE %s TO %s_app;\n' "$site" "$site" "$site" | runuser -u postgres -- psql --cluster "17/$site" --dbname postgres --set ON_ERROR_STOP=1 --quiet
  PGPASSWORD="$password" psql -h 127.0.0.1 -p "$port" -U "${site}_app" -d "$site" -c 'SELECT 1' >/dev/null
  connection="postgresql://${site}_app:${password}@postgres-native.${namespace}.svc.cluster.local:${port}/${site}"
  printf 'PORTFOLIO_DATABASE_URL=%s\n' "$connection" > /etc/site-platform/portfolio-database.env
  unset password connection
done
install -d -m 0755 /etc/systemd/system/k3s.service.d
printf '[Unit]\nWants=postgresql@17-portfolio.service\nAfter=postgresql@17-portfolio.service\n' > /etc/systemd/system/k3s.service.d/portfolio-postgres.conf
systemctl daemon-reload
printf '%s\n' "$private_ip" > /etc/site-platform/private-ip
echo "Native PostgreSQL is ready. Database: portfolio:5433; private node address: $private_ip."
echo "Connection files are root-only under /etc/site-platform. No Kubernetes Secret, pod, DNS record or existing database was deleted/migrated. Follow the cutover guide."