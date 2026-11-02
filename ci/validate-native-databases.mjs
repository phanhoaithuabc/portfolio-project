import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import YAML from "yaml";
function render(chart, namespace, options = [], expectFailure = false) {
  const result = spawnSync(
    process.env.HELM_BIN ?? "helm",
    [
      "template",
      chart,
      `deploy/helm/${chart}`,
      "--namespace",
      namespace,
      ...options,
    ],
    { encoding: "utf8" },
  );
  if (expectFailure) {
    assert.notEqual(result.status, 0);
    return [];
  }
  assert.equal(result.status, 0, result.stderr || String(result.error));
  return YAML.parseAllDocuments(result.stdout)
    .map((document) => {
      assert.equal(document.errors.length, 0);
      return document.toJSON();
    })
    .filter(Boolean);
}

const resources = render("portfolio", "portfolio", [
  "-f",
  "ops/native/portfolio-values.yaml",
  "--set",
  "nativeDatabase.address=10.20.1.10",
]);
const slice = resources.find((item) => item.kind === "EndpointSlice");
assert.equal(slice.endpoints[0].addresses[0], "10.20.1.10");
assert.equal(slice.ports[0].port, 5433);
assert.ok(!resources.some((item) => item.kind === "StatefulSet"));
for (const address of [undefined, "8.8.8.8"])
  render(
    "portfolio",
    "portfolio",
    [
      "-f",
      "ops/native/portfolio-values.yaml",
      ...(address ? ["--set", "nativeDatabase.address=" + address] : []),
    ],
    true,
  );
console.log(
  "portfolio: native database endpoints and private-address guards validated.",
);
