import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import YAML from "yaml";
import {
  digestImageValues,
  updateImageValues,
} from "../ci/update-portfolio-images.mjs";
import { manifestDigest } from "../scripts/resolve-image-digest.mjs";
import {
  createOrReusePromotionPullRequest,
  repositoryFromGitUrl,
} from "../scripts/open-gitops-pr.mjs";

const root = path.resolve(import.meta.dirname, "..");

test("portfolio promotion values require immutable SHA-256 digests", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "portfolio-promotion-"));
  try {
    const gitops = path.join(directory, "deploy/gitops/portfolio");
    await mkdir(gitops, { recursive: true });
    await writeFile(path.join(gitops, "images.yaml"), "images: {}\n");
    const input = {
      prefix: "ghcr.io/example",
      sourceTag: `sha-${"a".repeat(40)}`,
      apiDigest: `sha256:${"b".repeat(64)}`,
      webDigest: `sha256:${"c".repeat(64)}`,
    };
    const result = digestImageValues(input);
    assert.equal(
      result.api,
      `ghcr.io/example/portfolio-api@${input.apiDigest}`,
    );
    assert.equal(
      result.web,
      `ghcr.io/example/portfolio-web@${input.webDigest}`,
    );
    assert.throws(
      () => digestImageValues({ ...input, webDigest: "latest" }),
      /sha256/,
    );
    updateImageValues(directory, input);
    const values = YAML.parse(
      await readFile(path.join(gitops, "images.yaml"), "utf8"),
    );
    assert.deepEqual(values.images, result);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("registry manifest digest hashes the exact OCI bytes", () => {
  const manifest = Buffer.from(
    JSON.stringify({
      schemaVersion: 2,
      mediaType: "application/vnd.oci.image.manifest.v1+json",
    }),
  );
  assert.equal(
    manifestDigest(manifest),
    `sha256:${createHash("sha256").update(manifest).digest("hex")}`,
  );
  assert.throws(() => manifestDigest(Buffer.from("{}")), /manifest/);
});

test("provenance records the source commit for the tagged image", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "portfolio-provenance-"));
  try {
    const output = path.join(directory, "provenance.json");
    execFileSync(process.execPath, [
      path.join(root, "scripts/create-provenance.mjs"),
      `ghcr.io/example/portfolio-api:sha-${"a".repeat(40)}`,
      `sha256:${"b".repeat(64)}`,
      "a".repeat(40),
      output,
    ]);
    const predicate = JSON.parse(await readFile(output, "utf8"));
    assert.equal(
      predicate.buildDefinition.resolvedDependencies[0].digest.gitCommit,
      "a".repeat(40),
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("promotion PRs target the built repository and are idempotent", async () => {
  assert.equal(
    repositoryFromGitUrl("https://github.com/example/portfolio.git"),
    "example/portfolio",
  );
  assert.equal(
    repositoryFromGitUrl("git@github.com:example/portfolio.git"),
    "example/portfolio",
  );
  assert.throws(() => repositoryFromGitUrl("https://example.com/a/b"));
  const reused = await createOrReusePromotionPullRequest({
    repository: "example/portfolio",
    base: "main",
    head: "automation/portfolio-1",
    title: "Deploy",
    body: "Digest promotion",
    token: "test-token",
    fetchImpl: async () =>
      new Response(
        JSON.stringify([{ html_url: "https://github.com/example/p/pull/7" }]),
        { status: 200 },
      ),
  });
  assert.equal(reused, "https://github.com/example/p/pull/7");
});

test("pipeline publishes only from main through signed, reviewed promotion", async () => {
  const jenkins = await readFile(path.join(root, "Jenkinsfile"), "utf8");
  assert.match(jenkins, /portfolio-rootless-builder/);
  assert.doesNotMatch(jenkins, /--ignore-unfixed/);
  assert.doesNotMatch(jenkins, /push origin HEAD:main/);
  assert.match(jenkins, /cosign verify-attestation/);
  assert.match(jenkins, /open-gitops-pr\.mjs/);
  for (const stage of [
    "Publish immutable images",
    "Sign and attest artifacts",
    "Open reviewed promotion PR",
  ])
    assert.match(
      jenkins,
      new RegExp(`stage\\('${stage}'\\) \\{\\s*when \\{ branch 'main' \\}`),
    );
  const bootstrap = await readFile(
    path.join(root, "scripts/bootstrap-jenkins.sh"),
    "utf8",
  );
  assert.doesNotMatch(bootstrap, /docker\.sock/);
  const workloads = await readFile(
    path.join(root, "deploy/helm/portfolio/templates/workloads.yaml"),
    "utf8",
  );
  assert.doesNotMatch(workloads, /Values\.images\.tag/);
  assert.match(workloads, /initContainers:[\s\S]*name: migrate/);
  assert.match(
    workloads,
    /command: \[node, services\/portfolio\/src\/migrate\.js\]/,
  );
});
