import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import YAML from "yaml";

for (const options of [
  [],
  ["-f", "deploy/gitops/portfolio/values.yaml", "--set", "replicas=3"],
]) {
  const result = spawnSync(
    process.env.HELM_BIN ?? "helm",
    [
      "template",
      "portfolio",
      "deploy/helm/portfolio",
      "--namespace",
      "portfolio",
      ...options,
    ],
    { encoding: "utf8" },
  );
  assert.equal(result.status, 0, result.stderr || String(result.error));
  const resources = YAML.parseAllDocuments(result.stdout)
    .map((document) => {
      assert.equal(document.errors.length, 0);
      return document.toJSON();
    })
    .filter(Boolean);
  const api = resources.find(
    (resource) =>
      resource.kind === "Deployment" &&
      resource.metadata.name === "portfolio-api",
  );
  assert.equal(api.spec.replicas, 1);
  assert.equal(api.spec.strategy.type, "Recreate");
  const pod = api.spec.template.spec;
  const app = pod.containers[0];
  const migrate = pod.initContainers.find(
    (container) => container.name === "migrate",
  );
  assert.equal(migrate.image, app.image);
  assert.equal(
    app.env.find((variable) => variable.name === "PORTFOLIO_STORE").value,
    "sqlite",
  );
  for (const container of [app, migrate]) {
    assert.equal(
      container.env.find(
        (variable) => variable.name === "PORTFOLIO_DATABASE_FILE",
      ).value,
      "/var/lib/portfolio/database/portfolio.sqlite",
    );
    assert.ok(
      container.volumeMounts.some(
        (mount) =>
          mount.name === "database" &&
          mount.mountPath === "/var/lib/portfolio/database",
      ),
    );
  }
  assert.ok(
    pod.volumes.some(
      (volume) =>
        volume.name === "database" &&
        volume.persistentVolumeClaim.claimName === "portfolio-database",
    ),
  );
  assert.ok(
    resources.some(
      (resource) =>
        resource.kind === "PersistentVolumeClaim" &&
        resource.metadata.name === "portfolio-database" &&
        resource.spec.accessModes.includes("ReadWriteOnce"),
    ),
  );
  assert.ok(
    !resources.some((resource) =>
      ["Job", "StatefulSet", "EndpointSlice"].includes(resource.kind),
    ),
  );
  for (const policy of resources.filter(
    (resource) => resource.kind === "NetworkPolicy",
  ))
    for (const rule of policy.spec.egress ?? [])
      for (const port of rule.ports ?? [])
        assert.ok(![5432, 5433].includes(port.port));
}
console.log(
  "SQLite persistent storage, migration mount and single-writer deployment validated.",
);
