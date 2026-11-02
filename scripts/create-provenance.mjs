import fs from "node:fs";

const [image, digest, commit, output] = process.argv.slice(2);
const finishedOn = new Date().toISOString();
if (
  !/^[a-z0-9./:_-]+$/.test(image ?? "") ||
  !/^sha256:[a-f0-9]{64}$/.test(digest ?? "") ||
  !/^[a-f0-9]{40}$/.test(commit ?? "") ||
  !output
)
  throw new Error(
    "Usage: create-provenance.mjs image sha256:digest git-commit output.json",
  );

const predicate = {
  buildDefinition: {
    buildType: "https://jenkins.io/pipeline",
    externalParameters: {
      image,
      sourceRef: `refs/heads/${process.env.BRANCH_NAME ?? "local"}`,
    },
    internalParameters: { job: process.env.JOB_NAME ?? "local" },
    resolvedDependencies: [
      {
        uri:
          process.env.GIT_URL ??
          "git+https://github.com/REPLACE_ME/portfolio.git",
        digest: { gitCommit: commit },
      },
    ],
  },
  runDetails: {
    builder: {
      id: process.env.JENKINS_URL
        ? `${process.env.JENKINS_URL.replace(/\/$/, "")}/`
        : "https://jenkins.io/",
    },
    metadata: {
      invocationId:
        process.env.BUILD_URL ?? process.env.BUILD_TAG ?? `local-${commit}`,
      startedOn: process.env.BUILD_STARTED_AT ?? finishedOn,
      finishedOn,
    },
    byproducts: [],
  },
};
fs.writeFileSync(output, `${JSON.stringify(predicate, null, 2)}\n`, {
  mode: 0o600,
});
