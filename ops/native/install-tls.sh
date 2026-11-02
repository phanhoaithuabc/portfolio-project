#!/usr/bin/env bash
set -euo pipefail
apply=false
email=""
namespace=portfolio
cert_manager_version=v1.21.3
while [[ $# -gt 0 ]]; do
  case "$1" in
    --apply) apply=true; shift ;;
    --email) email="${2:?Email required}"; shift 2 ;;
    --namespace|--dailypick-namespace) namespace="${2:?Namespace required}"; shift 2 ;;
    --cert-manager-version) cert_manager_version="${2:?Version required}"; shift 2 ;;
    *) echo "Usage: install-tls.sh --email you@example.com [--namespace portfolio] [--apply]" >&2; exit 1 ;;
  esac
done
if [[ ! "$namespace" =~ ^[a-z0-9][a-z0-9-]*$ || ! "$cert_manager_version" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]]; then echo "Invalid namespace or version" >&2; exit 1; fi
if [[ "$apply" != true ]]; then echo "Dry-run: request portfolio-tls for phanhoaithu.io.vn in $namespace using cert-manager $cert_manager_version. No changes made."; exit 0; fi
if [[ "$EUID" -ne 0 ]]; then echo "Run as server administrator." >&2; exit 1; fi
if [[ ! "$email" =~ ^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$ ]]; then echo "Valid --email required" >&2; exit 1; fi
export KUBECONFIG="${KUBECONFIG:-/etc/rancher/k3s/k3s.yaml}"
kubectl get namespace "$namespace" >/dev/null
kubectl get ingressclass traefik >/dev/null
helm upgrade --install cert-manager oci://quay.io/jetstack/charts/cert-manager --version "$cert_manager_version" --namespace cert-manager --create-namespace --set crds.enabled=true --wait --timeout 5m
kubectl apply -f - <<EOF
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata: { name: letsencrypt-prod }
spec:
  acme:
    email: "$email"
    server: https://acme-v02.api.letsencrypt.org/directory
    privateKeySecretRef: { name: letsencrypt-prod-account-key }
    solvers:
      - http01:
          ingress: { ingressClassName: traefik }
---
apiVersion: cert-manager.io/v1
kind: Certificate
metadata: { name: portfolio-tls, namespace: "$namespace" }
spec:
  secretName: portfolio-tls
  issuerRef: { name: letsencrypt-prod, kind: ClusterIssuer }
  dnsNames: [phanhoaithu.io.vn]
EOF
kubectl wait --for=condition=Ready certificate/portfolio-tls -n "$namespace" --timeout=10m
