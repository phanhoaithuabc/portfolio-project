import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const root = path.resolve(import.meta.dirname, "..");
const manifest = JSON.parse(
  fs.readFileSync(path.join(root, "package.json"), "utf8"),
);
const require = createRequire(path.join(root, "package.json"));
const apps = fs
  .readdirSync(path.join(root, "apps"), { withFileTypes: true })
  .filter((entry) => entry.isDirectory());
assert.equal(apps.length, 1, "Exactly one application workspace is required");
const app = apps[0].name;
const contract = JSON.parse(
  fs.readFileSync(path.join(root, "packages/contracts/package.json"), "utf8"),
).name;
const contained = (filename) => {
  const relative = path.relative(root, filename);
  return (
    relative !== ".." &&
    !relative.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relative)
  );
};
assert.ok(
  contained(fs.realpathSync(require.resolve(contract))),
  "Contracts must resolve inside this project",
);
assert.ok(
  fs.existsSync(path.join(root, "apps", app, "package.json")),
  "Application workspace manifest is required",
);
function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (
      [
        "node_modules",
        ".git",
        ".terraform",
        "dist",
        "data",
        "reports",
      ].includes(entry.name)
    )
      return [];
    const filename = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) return [];
    return entry.isDirectory()
      ? walk(filename)
      : entry.isFile()
        ? [filename]
        : [];
  });
}
const files = walk(root);
for (const filename of files.filter((entry) => entry.endsWith(".md"))) {
  const source = fs.readFileSync(filename, "utf8");
  for (const match of source.matchAll(/\]\(([^)]+)\)/g)) {
    const target = match[1].split(/\s+"/)[0];
    if (/^(?:https?:|mailto:|#)/.test(target)) continue;
    const relative = decodeURIComponent(target.split("#")[0]);
    if (!relative) continue;
    const resolved = path.resolve(path.dirname(filename), relative);
    assert.ok(
      contained(resolved),
      `${filename}: link escapes project: ${target}`,
    );
    assert.ok(
      fs.existsSync(resolved),
      `${filename}: missing document target: ${target}`,
    );
  }
}
for (const filename of files.filter(
  (entry) => path.basename(entry) === "Dockerfile",
)) {
  if (filename.includes(`${path.sep}ci${path.sep}`)) continue;
  const source = fs.readFileSync(filename, "utf8");
  for (const line of source.split(/\r?\n/)) {
    if (!/^COPY\s+/i.test(line) || line.includes("--from=")) continue;
    const parts = line
      .trim()
      .split(/\s+/)
      .slice(1, -1)
      .filter((entry) => !entry.startsWith("--"));
    for (const input of parts) {
      if (/[\[*?]/.test(input)) continue;
      const resolved = path.resolve(root, input);
      assert.ok(
        contained(resolved) && fs.existsSync(resolved),
        `${filename}: missing Docker input: ${input}`,
      );
    }
  }
}
console.log(
  `${manifest.name}: project-local packages, Docker inputs and documentation links validated.`,
);
