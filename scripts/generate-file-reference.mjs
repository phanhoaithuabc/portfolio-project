import fs from "node:fs";
import path from "node:path";
const excluded = new Set([
  "node_modules",
  ".terraform",
  ".git",
  "dist",
  "data",
]);
const descriptions = {
  "README.md": "Project entry point and links to detailed guides.",
  Jenkinsfile:
    "CI tests, image builds, PostgreSQL integration, security gates, registry push and GitOps promotion.",
  Dockerfile:
    "Shared non-root backend image with TypeScript and OpenTelemetry preloaded.",
  "compose.yaml":
    "Developer-only PostgreSQL/Kafka helper; Kubernetes is the deployment architecture.",
  "package.json": "Workspace membership, scripts and shared dependencies.",
  "package-lock.json": "Exact npm dependency graph.",
  "tsconfig.json": "Strict backend/shared-contract/test TypeScript settings.",
  "infra/cloud-init.yaml":
    "Ubuntu Docker, k3s, encryption-at-rest setting, Helm and kernel-limit bootstrap.",
  "apps/storefront/src/App.tsx":
    "Storefront composition, search/filter/navigation state, collection sections and dialog coordination.",
  "apps/storefront/src/main.tsx": "React entry point and i18n initialization.",
  "apps/storefront/src/lib/api.ts":
    "Typed requests, timeouts, durable checkout fingerprint/key and error handling.",
  "apps/storefront/src/lib/storage.ts":
    "Guarded browser-storage helpers with value validation.",
  "apps/storefront/src/lib/i18n.ts":
    "Supported languages/currencies, sample rates and locale-aware money hook.",
  "apps/storefront/src/hooks/useShopping.ts":
    "Persistent cart/wishlist state, quantities and derived subtotal.",
  "services/orders/src/postgres.ts":
    "PostgreSQL pool and atomic order/outbox transaction, concurrent idempotency and trace carrier.",
  "services/orders/src/repository.ts":
    "Persistence boundary and idempotency conflict type.",
  "services/orders/src/app.ts":
    "Checkout validation, trusted prices, replay detection, order reads and database readiness.",
  "services/orders/src/migrate.ts":
    "Idempotent SQL migration with a PostgreSQL advisory lock.",
  "services/catalog/src/products.ts":
    "Typed seeded read-only assortment and product image URLs.",
  "services/catalog/src/app.ts":
    "Product filtering/details and health/metrics endpoints.",
  "services/gateway/src/index.ts":
    "API allowlist, timeouts, trace propagation, cache and admission control.",
  "services/workers/src/kafka.ts": "Kafka options and versioned topic names.",
  "services/workers/src/outbox.ts":
    "Bounded publisher, broker acknowledgment and backlog metrics.",
  "services/workers/src/consumer.ts":
    "Event validation, DLQ routing, tracing, group lag polling and termination.",
  "services/workers/src/processor.ts":
    "Outbox claiming and atomic deduplicated fulfillment-job transactions.",
  "packages/contracts/src/index.ts":
    "Product/order interfaces, checkout schema and USD-cent shipping rule.",
  "packages/observability/src/register.ts":
    "Early OTel SDK initialization and OTLP export.",
  "packages/observability/src/http.ts":
    "Prometheus process/request metrics and trace-correlated Pino logs.",
  "packages/observability/src/lifecycle.ts": "Bounded SIGTERM HTTP draining.",
  "tests/api.test.ts":
    "Fast checkout/search/price/quantity/idempotency HTTP regression test.",
  "tests/memory-orders.ts":
    "Test-only persistence adapter, never a runtime fallback.",
  "tests/postgres.test.ts":
    "Opt-in PostgreSQL concurrency, outbox retry and consumer deduplication test.",
  "tests/load/sale.js":
    "Bounded k6 browse scenario with latency/error thresholds.",
};
const components = {
  CartDrawer: "Cart, shipping, demo checkout and order confirmation",
  Countdown: "Campaign timer",
  Dialog:
    "Accessible native modal, focus/escape/backdrop behavior and scroll locking",
  LocaleSelector: "Persistent language/currency controls",
  OrderHistory: "Backend order lookup for browser-saved references",
  ProductCard: "Product photo, price, rating, wishlist and quick-add UI",
  ProductDetails: "Product details, quantity and add-to-cart UI",
};
function describe(file) {
  if (descriptions[file]) return descriptions[file];
  const name = path.basename(file);
  if (file.startsWith("apps/storefront/src/components/"))
    return `${components[name.replace(/\.(tsx|css)$/, "")] ?? "Reusable storefront component"}${file.endsWith(".css") ? " responsive styles" : ""}.`;
  if (file.endsWith("/index.ts") && file.startsWith("services/"))
    return "Service listener, environment wiring and shutdown entry point.";
  if (file.startsWith("services/orders/migrations/"))
    return "Orders/outbox/deduplication/job tables, constraints and indexes.";
  if (file.startsWith("infra/") && file.endsWith(".tf"))
    return `${file.split("/")[1].toUpperCase()} ${name === "main.tf" ? "network, firewall, disk and one-VM resources" : name === "variables.tf" ? "validated operator inputs and resource defaults" : name === "outputs.tf" ? "non-secret resource/connection outputs" : "Terraform/provider constraints"}.`;
  if (name === ".terraform.lock.hcl")
    return "Provider versions/checksums for reproducible initialization.";
  if (file.startsWith("deploy/helm/"))
    return `Helm ${file.split("/")[2]}: ${file.includes("/templates/") ? `renders ${name.replace(".yaml", "")} resources` : file.includes("/files/") ? `provisioned ${name} configuration` : name === "Chart.yaml" ? "chart metadata" : "operator defaults and resource budgets"}.`;
  if (file.startsWith("deploy/gitops/"))
    return `${file.split("/")[3]} ${name === "images.yaml" ? "immutable image promotion values; CI writes lab only" : "environment Helm overrides"}.`;
  if (file.startsWith("deploy/argocd/"))
    return `Argo CD ${name === "project.yaml" ? "allowed repositories/destinations/resource kinds" : name === "application.yaml" ? "multi-source Helm application and reconciliation policy" : "small-footprint administrator chart overrides"}.`;
  if (file.startsWith("docs/"))
    return `Detailed ${name.replace(".md", "").replaceAll("-", " ")} guide.`;
  if (file.startsWith("scripts/"))
    return `Automation for ${name.replace(/\.(mjs|sh)$/, "").replaceAll("-", " ")}; review before execution.`;
  if (file.endsWith("Dockerfile"))
    return file.startsWith("ci/")
      ? "Trusted Jenkins builder image with Node/Docker/Helm/Terraform/Trivy and pipeline plugins."
      : "React build stage and unprivileged Nginx runtime.";
  if (file.endsWith("nginx.conf"))
    return "Static hosting, API proxy and health/readiness on port 8080.";
  if (file.includes("/locales/"))
    return "Vietnamese UI/product-name dictionary with English fallback.";
  if (/\.(svg|png)$/.test(file))
    return "Generated starter asset, not current marketplace product photography.";
  if (file.endsWith(".css"))
    return "Typography, design tokens, layouts and responsive/interactive styling.";
  if (file.endsWith(".json"))
    return "Package/build/tool configuration for the owning module.";
  if (file.endsWith(".html"))
    return "HTML shell, page metadata and frontend entry module.";
  if (file.includes("tfvars"))
    return "Example non-secret environment inputs; replace documentation CIDR/key placeholders.";
  if (name.startsWith("."))
    return "Tool exclusions or example configuration; keep live credentials/state out of Git.";
  return "Supporting file for the owning directory; consult its source and guide.";
}
function walk(directory = ".") {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (
      excluded.has(entry.name) ||
      (entry.name.startsWith(".env") && !entry.name.endsWith(".example")) ||
      entry.name === "backend.hcl" ||
      (entry.name.endsWith(".tfvars") && !entry.name.endsWith(".example"))
    )
      return [];
    const file = path.posix.join(directory, entry.name);
    if (entry.isDirectory()) return walk(file);
    return /\.tsbuildinfo$|\.tfstate|\.tfplan$/.test(file) ? [] : [file];
  });
}
const files = [...new Set([...walk(), "docs/file-reference.md"])].sort();
fs.writeFileSync(
  "docs/file-reference.md",
  `# File Reference\n\nGenerated by \`node scripts/generate-file-reference.mjs\`. Dependencies, build output, live database files, Terraform providers/state and secrets are excluded. Start with [Architecture](architecture.md) and [Deployment](deployment.md).\n\n| File | Responsibility |\n| --- | --- |\n${files.map((file) => `| [${file}](../${file}) | ${describe(file)} |`).join("\n")}\n`,
);
