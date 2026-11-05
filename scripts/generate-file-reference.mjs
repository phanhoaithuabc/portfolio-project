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
    "CI tests, image builds, SQLite integration, security gates, registry push and GitOps promotion.",
  Dockerfile:
    "Shared non-root backend image with TypeScript and OpenTelemetry preloaded.",
  "compose.yaml":
    "Local API/web containers with persistent SQLite and uploaded-media volumes.",
  "package.json": "Workspace membership, scripts and shared dependencies.",
  "package-lock.json": "Exact npm dependency graph.",
  "tsconfig.json": "Strict backend/shared-contract/test TypeScript settings.",
  "infra/cloud-init.yaml":
    "Ubuntu Docker, k3s, encryption-at-rest setting, Helm and kernel-limit bootstrap.",
  "services/portfolio/src/sqlite.ts":
    "SQLite repository, atomic content revisions and durable expiring sessions.",
  "services/portfolio/src/import-snapshot.ts":
    "Validated transactional import of existing portfolio data into an empty database.",
  "services/portfolio/src/migrations.ts":
    "Checksum-verified SQLite migrations under an immediate write transaction.",
  "packages/contracts/src/index.ts":
    "Shared validated portfolio content, contact and editor contracts.",
  "packages/observability/src/register.ts":
    "Early OTel SDK initialization and OTLP export.",
  "packages/observability/src/http.ts":
    "Prometheus process/request metrics and trace-correlated Pino logs.",
  "packages/observability/src/lifecycle.ts": "Bounded SIGTERM HTTP draining.",
  "tests/portfolio-sqlite.test.ts":
    "File-backed persistence, stale edits, session expiry and atomic snapshot import tests.",
};
function describe(file) {
  if (descriptions[file]) return descriptions[file];
  const name = path.basename(file);
  if (file.endsWith("/index.ts") && file.startsWith("services/"))
    return "Service listener, environment wiring and shutdown entry point.";
  if (file.startsWith("services/portfolio/migrations/"))
    return "SQLite content, sessions, revisions, contacts, password and analytics schema.";
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
  if (/\.(svg|png)$/.test(file)) return "Portfolio visual asset.";
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
