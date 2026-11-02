import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import YAML from "yaml";
function render(chart, namespace) {
  const result = spawnSync(
    process.env.HELM_BIN ?? "helm",
    ["template", chart, `deploy/helm/${chart}`, "--namespace", namespace],
    { encoding: "utf8" },
  );
  if (result.status !== 0)
    throw new Error(result.stderr || String(result.error));
  return YAML.parseAllDocuments(result.stdout)
    .map((document) => {
      if (document.errors.length) throw new Error(String(document.errors));
      return document.toJSON();
    })
    .filter(Boolean);
}

const database = render("portfolio-db", "portfolio-data");
const app = render("portfolio", "portfolio");
assert.ok(
  database.some(
    (item) =>
      item.kind === "StatefulSet" &&
      item.metadata.name === "portfolio-postgres",
  ),
);
for (const resource of app.filter(
  (item) =>
    item.kind === "Job" ||
    (item.kind === "Deployment" && item.metadata.name === "portfolio-api"),
)) {
  assert.equal(
    resource.spec.template.spec.containers[0].env.find(
      (entry) => entry.name === "PORTFOLIO_EXPECTED_DATABASE_HOST",
    ).value,
    "postgres.portfolio-data.svc.cluster.local",
  );
}
console.log("Portfolio database hostname and pod storage validated.");
