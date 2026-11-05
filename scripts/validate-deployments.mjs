import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import YAML from "yaml";

const helm = process.env.HELM_BIN ?? "helm";
for (const [chart, namespace] of [
  ["portfolio", "portfolio"],
  ["observability", "observability"],
]) {
  const lint = spawnSync(helm, ["lint", `deploy/helm/${chart}`], {
    encoding: "utf8",
  });
  assert.equal(
    lint.status,
    0,
    lint.stderr || lint.stdout || String(lint.error),
  );
  const rendered = spawnSync(
    helm,
    ["template", chart, `deploy/helm/${chart}`, "--namespace", namespace],
    { encoding: "utf8" },
  );
  assert.equal(rendered.status, 0, rendered.stderr || String(rendered.error));
  for (const document of YAML.parseAllDocuments(rendered.stdout)) {
    assert.equal(document.errors.length, 0);
    const resource = document.toJSON();
    if (!resource) continue;
    assert.ok(resource.kind && resource.apiVersion && resource.metadata?.name);
    for (const container of resource.spec?.template?.spec?.containers ?? [])
      for (const variable of container.env ?? [])
        if ("value" in variable) assert.equal(typeof variable.value, "string");
  }
  console.log(`${chart}: lint and rendered resources validated.`);
}
const externalSecretsWithoutKey = spawnSync(
  helm,
  [
    "template",
    "portfolio",
    "deploy/helm/portfolio",
    "--set",
    "externalSecrets.enabled=true",
  ],
  { encoding: "utf8" },
);
assert.notEqual(
  externalSecretsWithoutKey.status,
  0,
  "ExternalSecrets must require runtimeKey",
);
const externalSecretsRendered = spawnSync(
  helm,
  [
    "template",
    "portfolio",
    "deploy/helm/portfolio",
    "--set",
    "externalSecrets.enabled=true",
    "--set",
    "externalSecrets.runtimeKey=portfolio/lab/runtime",
  ],
  { encoding: "utf8" },
);
assert.equal(
  externalSecretsRendered.status,
  0,
  externalSecretsRendered.stderr || String(externalSecretsRendered.error),
);
assert.match(externalSecretsRendered.stdout, /kind: ExternalSecret/);
console.log("portfolio/externalSecrets: ExternalSecret validated.");
