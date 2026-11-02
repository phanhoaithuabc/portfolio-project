#!/usr/bin/env bash
set -euo pipefail

if [[ "${EUID}" -eq 0 ]]; then
  echo "Refusing to run CI jobs as root." >&2
  exit 1
fi
case "${DOCKER_HOST:-}" in
  unix:///run/user/*/podman/podman.sock) ;;
  *) echo "DOCKER_HOST must point to the dedicated rootless Podman socket." >&2; exit 1 ;;
esac
security_options="$(docker info --format '{{json .SecurityOptions}}')"
if [[ "${security_options,,}" != *rootless* ]]; then
  echo "Container engine did not report rootless mode." >&2
  exit 1
fi
for tool in node npm docker skopeo trivy cosign helm terraform; do
  command -v "$tool" >/dev/null || { echo "Missing rootless agent tool: $tool" >&2; exit 1; }
done
