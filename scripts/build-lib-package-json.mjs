#!/usr/bin/env node
// Writes lib/esm/package.json for the build, copying every field from the
// root package.json except the ones that only make sense at the repo root
// (scripts, devDependencies, files).
//
// The root package.json's main/types/bin/exports point directly at the
// TypeScript source under src/ (a single source of truth, run natively by
// bun for self-reference/tests within this repo) instead of at compiled
// output. `npm pack ./lib/esm/` packs the *compiled* output as its own
// package, so this script maps each of those src/*.ts paths to the
// compiled .js/.d.ts pair tsc emits for it under lib/esm/ (same relative
// path, rootDir src -> outDir lib/esm), and writes those instead.

import { readFile, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = join(repoRoot, "src");
const libEsmDir = join(repoRoot, "lib", "esm");

const rootPackageJson = JSON.parse(
  await readFile(join(repoRoot, "package.json"), "utf8"),
);

// "./src/foo/bar.ts" (relative to repoRoot) -> the .js/.d.ts pair tsc
// emits at lib/esm/foo/bar.{js,d.ts}.
const compiledPathsFor = (tsPath) => {
  const relFromSrcDir = relative(srcDir, join(repoRoot, tsPath)).replace(
    /\.ts$/,
    "",
  );
  return { js: `./${relFromSrcDir}.js`, dts: `./${relFromSrcDir}.d.ts` };
};

const rewriteExportsValue = (value) => {
  if (typeof value === "string") {
    const { js, dts } = compiledPathsFor(value);
    return { types: dts, import: js };
  }
  if (Array.isArray(value)) {
    return value.map(rewriteExportsValue);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, v]) => [key, rewriteExportsValue(v)]),
    );
  }
  return value;
};

const { scripts, devDependencies, files, ...rest } = rootPackageJson;

const mainPaths = compiledPathsFor(rest.main);

const libPackageJson = {
  ...rest,
  main: mainPaths.js,
  types: mainPaths.dts,
  ...(rest.bin
    ? {
        bin: Object.fromEntries(
          Object.entries(rest.bin).map(([name, tsPath]) => [
            name,
            compiledPathsFor(tsPath).js,
          ]),
        ),
      }
    : {}),
  ...(rest.exports ? { exports: rewriteExportsValue(rest.exports) } : {}),
};

await writeFile(
  join(libEsmDir, "package.json"),
  `${JSON.stringify(libPackageJson, null, 2)}\n`,
);
