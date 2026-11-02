import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";

export function manifestDigest(manifest) {
  const bytes = Buffer.isBuffer(manifest) ? manifest : Buffer.from(manifest);
  const parsed = JSON.parse(bytes.toString("utf8"));
  if (!parsed.mediaType || !parsed.schemaVersion)
    throw new Error("Registry response is not an OCI/Docker image manifest.");
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

export function resolveImageDigest(image, run = execFileSync) {
  if (!/^[a-z0-9./_-]+:[a-zA-Z0-9_.-]+$/.test(image ?? ""))
    throw new Error("Provide a fully qualified image:tag reference.");
  const dockerConfig =
    process.env.DOCKER_CONFIG ?? `${process.env.HOME}/.docker`;
  const manifest = run(
    "skopeo",
    [
      "inspect",
      "--raw",
      "--authfile",
      `${dockerConfig}/config.json`,
      `docker://${image}`,
    ],
    {
      encoding: "buffer",
      maxBuffer: 8 * 1024 * 1024,
      stdio: ["ignore", "pipe", "inherit"],
    },
  );
  return manifestDigest(manifest);
}

if (process.argv[1]?.endsWith("resolve-image-digest.mjs")) {
  const [, , image] = process.argv;
  console.log(resolveImageDigest(image));
}
