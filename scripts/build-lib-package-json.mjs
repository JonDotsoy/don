#!/usr/bin/env node
// Writes lib/esm/package.json for the build, copying every field from the
// root package.json except the ones that only make sense at the repo root
// (scripts, devDependencies, files). Relative paths (main, types, bin,
// exports) are rewritten from being relative to the repo root to being
// relative to lib/esm/, since `npm pack ./lib/esm/` packs that directory
// directly.

import { readFile, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const libEsmDir = join(repoRoot, "lib", "esm");

const rootPackageJson = JSON.parse(
  await readFile(join(repoRoot, "package.json"), "utf8"),
);

const rewriteRelativePaths = (value) => {
  if (Array.isArray(value)) {
    return value.map(rewriteRelativePaths);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, v]) => [key, rewriteRelativePaths(v)]),
    );
  }
  if (typeof value === "string" && value.startsWith(".")) {
    return `./${relative(libEsmDir, join(repoRoot, value))}`;
  }
  return value;
};

const { scripts, devDependencies, files, ...rest } = rootPackageJson;

const libPackageJson = rewriteRelativePaths(rest);

await writeFile(
  join(libEsmDir, "package.json"),
  `${JSON.stringify(libPackageJson, null, 2)}\n`,
);
