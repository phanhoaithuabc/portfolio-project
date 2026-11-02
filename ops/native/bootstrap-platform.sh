#!/usr/bin/env bash
set -euo pipefail
umask 077
if [[ "${1:-}" != "--apply" ]]; then echo "Dry-run: bootstrap portfolio native database, platform services, observability and Argo CD only. No app, DNS or cloud changes. Use --apply after reviewing docs/native-postgres.md."; exit 0; fi
if [[ "$EUID" -ne 0 ]]; then echo "Run as the server administrator in your own terminal." >&2; exit 1; fi
export KUBECONFIG="${KUBECONFIG:-/etc/rancher/k3s/k3s.yaml}"
for tool in helm kubectl openssl; do command -v "$tool" >/dev/null || { echo "$tool is required" >&2; exit 1; }; done
if kubectl -n portfolio-data get statefulset portfolio-postgres >/dev/null 2>&1; then echo "Existing database pods found; use the backup/restore cutover guide." >&2; exit 1; fi
if grep -q REPLACE_ME deploy/argocd/portfolio.yaml; then echo "Configure your repository URL first." >&2; exit 1; fi
bash ops/native/install-postgres.sh --apply
for namespace in portfolio argocd observability; do kubectl create namespace "$namespace" --dry-run=client -o yaml | kubectl apply -f -; done
kubectl label namespace portfolio pod-security.kubernetes.io/enforce=restricted pod-security.kubernetes.io/warn=restricted pod-security.kubernetes.io/audit=restricted --overwrite
kubectl label namespace argocd pod-security.kubernetes.io/enforce=baseline pod-security.kubernetes.io/warn=restricted pod-security.kubernetes.io/audit=restricted --overwrite
# Matches DailyPick on the shared cluster, whose node exporter mounts the host filesystem.
kubectl label namespace observability pod-security.kubernetes.io/enforce=privileged pod-security.kubernetes.io/warn=baseline pod-security.kubernetes.io/audit=baseline --overwrite
kubectl apply -f deploy/traefik/helmchartconfig.yaml
if [[ ! -f /etc/site-platform/portfolio-session.env ]]; then printf 'PORTFOLIO_SESSION_SECRET=%s\n' "$(openssl rand -hex 48)" > /etc/site-platform/portfolio-session.env; fi
if ! kubectl -n portfolio get secret portfolio-runtime >/dev/null 2>&1; then
  kubectl -n portfolio create secret generic portfolio-runtime --from-env-file=/etc/site-platform/portfolio-database.env --from-env-file=/etc/site-platform/portfolio-session.env
fi
if ! kubectl -n observability get secret grafana-admin >/dev/null 2>&1; then kubectl -n observability create secret generic grafana-admin --from-literal=admin-password="$(openssl rand -hex 24)"; fi

helm upgrade --install observability deploy/helm/observability -n observability --wait --timeout 10m
helm repo add argo https://argoproj.github.io/argo-helm --force-update
helm repo update argo
helm upgrade --install argocd argo/argo-cd --version "${ARGO_CHART_VERSION:-7.8.23}" -n argocd -f deploy/argocd/values.yaml --wait --timeout 10m
if [[ "${INSTALL_EXTERNAL_SECRETS:-false}" == "true" ]]; then
  kubectl create namespace external-secrets --dry-run=client -o yaml | kubectl apply -f -
  kubectl label namespace external-secrets pod-security.kubernetes.io/enforce=restricted pod-security.kubernetes.io/warn=restricted pod-security.kubernetes.io/audit=restricted --overwrite
  helm repo add external-secrets https://charts.external-secrets.io --force-update
  helm repo update external-secrets
  helm upgrade --install external-secrets external-secrets/external-secrets --version "${ESO_CHART_VERSION:-2.14.0}" -n external-secrets --set installCRDs=true --wait --timeout 10m
  kubectl apply -f deploy/external-secrets/cluster-secret-store.yaml
fi
echo "Set nativeDatabase.address in deploy/gitops/portfolio/values.yaml to $(</etc/site-platform/private-ip), configure images/credentials/TLS, review and sync. Existing secrets are preserved."
