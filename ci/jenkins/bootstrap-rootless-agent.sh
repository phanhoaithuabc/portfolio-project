#!/usr/bin/env bash
set -euo pipefail
umask 077

if [[ "$EUID" -ne 0 ]]; then
  echo "Run this setup as the VM administrator." >&2
  exit 1
fi
if [[ "${1:-}" != "--apply" ]]; then
  echo "Dry-run: installs rootless Podman and a dedicated inbound Jenkins agent. Set JENKINS_AGENT_SECRET from your own terminal and run with --apply after reviewing docs/deployment.md."
  exit 0
fi
: "${JENKINS_AGENT_SECRET:?Set the inbound agent secret in your terminal, not in Git or chat}"
: "${JENKINS_URL:=http://host.containers.internal:8082}"
: "${JENKINS_AGENT_NAME:=portfolio-rootless-builder}"
if [[ ! "$JENKINS_URL" =~ ^https?://[A-Za-z0-9._:-]+(/.*)?$ || ! "$JENKINS_AGENT_NAME" =~ ^[A-Za-z0-9._-]{1,64}$ || ! "$JENKINS_AGENT_SECRET" =~ ^[A-Za-z0-9._-]{20,128}$ ]]; then
  echo "Invalid Jenkins URL, agent name, or agent secret format." >&2
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y --no-install-recommends podman uidmap slirp4netns fuse-overlayfs
if ! id portfolio-agent >/dev/null 2>&1; then
  useradd --create-home --shell /bin/bash portfolio-agent
fi
agent_uid="$(id -u portfolio-agent)"
ensure_subid_range() {
  local file="$1" option="$2" last start end
  if grep -q '^portfolio-agent:' "$file"; then return; fi
  last="$(awk -F: 'BEGIN { max=99999 } { end=$2+$3-1; if (end>max) max=end } END { print max }' "$file")"
  start=$((last + 1))
  end=$((start + 65535))
  usermod "$option" "${start}-${end}" portfolio-agent
}
touch /etc/subuid /etc/subgid
ensure_subid_range /etc/subuid --add-subuids
ensure_subid_range /etc/subgid --add-subgids
loginctl enable-linger portfolio-agent
install -d -o portfolio-agent -g portfolio-agent -m 0700 "/home/portfolio-agent/.config/systemd/user"
runuser -u portfolio-agent -- env HOME=/home/portfolio-agent USER=portfolio-agent LOGNAME=portfolio-agent XDG_RUNTIME_DIR="/run/user/$agent_uid" \
  DBUS_SESSION_BUS_ADDRESS="unix:path=/run/user/$agent_uid/bus" \
  systemctl --user enable --now podman.socket

runtime_directory="/home/portfolio-agent/.config"
install -o portfolio-agent -g portfolio-agent -m 0600 /dev/null "$runtime_directory/portfolio-agent.env"
printf 'JENKINS_URL=%s\nJENKINS_AGENT_NAME=%s\nJENKINS_SECRET=%s\n' \
  "$JENKINS_URL" "$JENKINS_AGENT_NAME" "$JENKINS_AGENT_SECRET" > "$runtime_directory/portfolio-agent.env"
chown portfolio-agent:portfolio-agent "$runtime_directory/portfolio-agent.env"
chmod 0600 "$runtime_directory/portfolio-agent.env"
unset JENKINS_AGENT_SECRET

unit_file="/home/portfolio-agent/.config/systemd/user/portfolio-agent.service"
cat > "$unit_file" <<UNIT
[Unit]
Description=Portfolio rootless Jenkins build agent
After=network-online.target podman.socket

[Service]
EnvironmentFile=%h/.config/portfolio-agent.env
Restart=always
RestartSec=10
ExecStart=/usr/bin/podman run --rm --name portfolio-rootless-agent --network slirp4netns:allow_host_loopback=true --userns=keep-id:uid=1000,gid=1000 --volume /run/user/$agent_uid/podman/podman.sock:/run/user/1000/podman/podman.sock:rw --env JENKINS_URL --env JENKINS_AGENT_NAME --env JENKINS_SECRET --env JENKINS_WEB_SOCKET=true --env DOCKER_HOST=unix:///run/user/1000/podman/podman.sock localhost/portfolio-jenkins-agent:local
ExecStop=/usr/bin/podman stop --time 10 portfolio-rootless-agent

[Install]
WantedBy=default.target
UNIT
chown portfolio-agent:portfolio-agent "$unit_file"
chmod 0600 "$unit_file"
repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
runuser -u portfolio-agent -- env HOME=/home/portfolio-agent USER=portfolio-agent LOGNAME=portfolio-agent XDG_RUNTIME_DIR="/run/user/$agent_uid" podman build \
  --tag localhost/portfolio-jenkins-agent:local \
  --file "$repository_root/ci/jenkins/agent.Dockerfile" "$repository_root"
runuser -u portfolio-agent -- env HOME=/home/portfolio-agent USER=portfolio-agent LOGNAME=portfolio-agent XDG_RUNTIME_DIR="/run/user/$agent_uid" \
  DBUS_SESSION_BUS_ADDRESS="unix:path=/run/user/$agent_uid/bus" \
  systemctl --user daemon-reload
runuser -u portfolio-agent -- env HOME=/home/portfolio-agent USER=portfolio-agent LOGNAME=portfolio-agent XDG_RUNTIME_DIR="/run/user/$agent_uid" \
  DBUS_SESSION_BUS_ADDRESS="unix:path=/run/user/$agent_uid/bus" \
  systemctl --user enable --now portfolio-agent.service
echo "Rootless agent image built and service started. Register this node in Jenkins with one executor and label portfolio-rootless-builder."
