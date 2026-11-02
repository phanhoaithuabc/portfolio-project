#!/usr/bin/env bash
set -euo pipefail
umask 077
if [[ "${1:-}" != "--apply" ]]; then
  echo "Dry-run: builds the Jenkins controller with Podman and runs it as a systemd-managed container on 127.0.0.1:8082 with zero executors and no container-engine socket. Re-run with --apply as the VM administrator."
  exit 0
fi
if [[ "$EUID" -ne 0 ]]; then echo "Run as the VM administrator." >&2; exit 1; fi
if ! command -v podman >/dev/null; then
  export DEBIAN_FRONTEND=noninteractive
  apt-get update
  apt-get install -y --no-install-recommends podman
fi
repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
podman build --pull --file "$repository_root/ci/jenkins/Dockerfile" --tag localhost/portfolio-jenkins:local "$repository_root"
podman volume exists portfolio-jenkins-home || podman volume create portfolio-jenkins-home
install -d -m 0755 /etc/containers/systemd
cat > /etc/containers/systemd/portfolio-jenkins.container <<'UNIT'
[Unit]
Description=Portfolio Jenkins controller

[Container]
Image=localhost/portfolio-jenkins:local
ContainerName=portfolio-jenkins
PublishPort=127.0.0.1:8082:8080
Volume=portfolio-jenkins-home:/var/jenkins_home
Environment=JAVA_OPTS=-Djenkins.model.Jenkins.numExecutors=0
PodmanArgs=--cpus=2 --memory=2g

[Service]
Restart=always

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl restart portfolio-jenkins.service
echo "Jenkins is bound to 127.0.0.1:8082. Use an SSH tunnel; see docs/deployment.md."