import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import YAML from "yaml";

const digestPattern = /^sha256:[a-f0-9]{64}$/;

export function digestImageValues({ prefix, sourceTag, apiDigest, webDigest }) {
  if (
    !/^[a-z0-9./_-]+$/.test(prefix ?? "") ||
    !/^sha-[a-f0-9]{40}$/.test(sourceTag ?? "") ||
    !digestPattern.test(apiDigest ?? "") ||
    !digestPattern.test(webDigest ?? "")
  )
    throw new Error(
      "Provide registry prefix, SHA source tag, and both sha256 image digests.",
    );
  return {
    api: `${prefix}/portfolio-api@${apiDigest}`,
    web: `${prefix}/portfolio-web@${webDigest}`,
    sourceTag,
  };
}

export function updateImageValues(root, input) {
  const file = path.join(root, "deploy", "gitops", "portfolio", "images.yaml");
  const values = YAML.parse(fs.readFileSync(file, "utf8"));
  values.images = digestImageValues(input);
  fs.writeFileSync(file, YAML.stringify(values));
  return file;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const [prefix, sourceTag, apiDigest, webDigest] = process.argv.slice(2);
  const file = updateImageValues(process.cwd(), {
    prefix,
    sourceTag,
    apiDigest,
    webDigest,
  });
  console.log(`Updated ${file} with immutable image digests.`);
}
