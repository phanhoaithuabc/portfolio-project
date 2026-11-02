const apiVersion = "2022-11-28";

export function repositoryFromGitUrl(url) {
  const match =
    /github\.com[:/]([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+?)(?:\.git)?\/?$/.exec(
      url ?? "",
    );
  if (!match) throw new Error("GIT_URL must be a GitHub repository URL.");
  return match[1];
}

export async function createOrReusePromotionPullRequest({
  repository,
  base,
  head,
  title,
  body,
  token,
  apiUrl = "https://api.github.com",
  fetchImpl = fetch,
}) {
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository ?? ""))
    throw new Error("GITOPS_REPOSITORY must be owner/repository.");
  if (!token)
    throw new Error(
      "A GitHub token with pull-request write access is required.",
    );
  const headers = {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "X-GitHub-Api-Version": apiVersion,
    "Content-Type": "application/json",
  };
  const [owner] = repository.split("/");
  const query = new URLSearchParams({
    state: "open",
    head: `${owner}:${head}`,
    base,
  });
  const lookup = await fetchImpl(
    `${apiUrl}/repos/${repository}/pulls?${query}`,
    { headers },
  );
  if (!lookup.ok)
    throw new Error(`Pull-request lookup failed (${lookup.status}).`);
  const existing = await lookup.json();
  if (existing[0]?.html_url) return existing[0].html_url;
  const created = await fetchImpl(`${apiUrl}/repos/${repository}/pulls`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      title,
      head,
      base,
      body,
      maintainer_can_modify: true,
    }),
  });
  if (!created.ok)
    throw new Error(`Pull-request creation failed (${created.status}).`);
  const pullRequest = await created.json();
  if (!pullRequest.html_url)
    throw new Error("GitHub returned no pull-request URL.");
  return pullRequest.html_url;
}

if (process.argv[1]?.endsWith("open-gitops-pr.mjs")) {
  const [head, sourceTag, apiDigest, webDigest] = process.argv.slice(2);
  const url = await createOrReusePromotionPullRequest({
    repository:
      process.env.GITOPS_REPOSITORY ??
      repositoryFromGitUrl(process.env.GIT_URL),
    base: process.env.GITOPS_BRANCH ?? "main",
    head,
    title: `[gitops] Deploy Portfolio ${sourceTag}`,
    body: [
      "## Immutable artifacts",
      `- Source: \`${sourceTag}\``,
      `- API: \`${apiDigest}\``,
      `- Web: \`${webDigest}\``,
      `- Build: ${process.env.BUILD_URL ?? "local"}`,
      "",
      "Review CI, SBOM, signatures, provenance, migration compatibility, and the rendered diff before merging.",
    ].join("\n"),
    token: process.env.GITOPS_TOKEN,
    apiUrl: process.env.GITHUB_API_URL,
  });
  console.log(`Promotion pull request: ${url}`);
}
