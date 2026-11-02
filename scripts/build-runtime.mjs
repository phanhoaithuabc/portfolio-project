import { build } from "esbuild";
import fs from "node:fs";
import { builtinModules } from "node:module";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const manifest = JSON.parse(
  fs.readFileSync(path.join(root, "package.json"), "utf8"),
);
const runtimeDependencies = Object.keys(manifest.dependencies);
fs.rmSync(path.join(root, "dist"), { recursive: true, force: true });
const result = await build({
  absWorkingDir: root,
  entryPoints: [
    "packages/observability/src/register.ts",
    "services/portfolio/src/index.ts",
    "services/portfolio/src/migrate.ts",
    "scripts/migrate-media-to-s3.ts",
  ],
  // Mirror source paths so import.meta.url-relative assets resolve the same way at runtime.
  outbase: ".",
  outdir: "dist",
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node24",
  external: runtimeDependencies,
  metafile: true,
  logLevel: "warning",
});
for (const [file, output] of Object.entries(result.metafile.outputs))
  for (const entry of output.imports) {
    if (!entry.external) continue;
    const specifier = entry.path.replace(/^node:/, "");
    const name = specifier.startsWith("@")
      ? specifier.split("/").slice(0, 2).join("/")
      : specifier.split("/")[0];
    if (!builtinModules.includes(name) && !runtimeDependencies.includes(name))
      throw new Error(
        `${file} imports ${entry.path}, which is not a runtime dependency`,
      );
  }
console.log("Runtime bundles written to dist/.");
