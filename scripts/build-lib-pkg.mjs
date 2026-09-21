#!/usr/bin/env node
// Writes a trimmed package.json into lib/ so `npm pack ./lib` (or
// publishing from lib/ directly) treats lib/ itself as the package root,
// without a nested lib/ subfolder inside the tarball: every "./lib/..."
// path becomes "./...", and fields only meaningful in the dev workspace
// (scripts, devDependencies, files) are dropped.
import { readFileSync, writeFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync("package.json", "utf8"));

const stripLibPrefix = (value) =>
  typeof value === "string" ? value.replace(/^\.\/lib\//, "./") : value;

const rewritePaths = (value) => {
  if (typeof value === "string") return stripLibPrefix(value);
  if (Array.isArray(value)) return value.map(rewritePaths);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, rewritePaths(v)]),
    );
  }
  return value;
};

const { scripts, devDependencies, files, ...rest } = pkg;

const trimmed = rewritePaths({
  ...rest,
  main: pkg.main,
  types: pkg.types,
  bin: pkg.bin,
  exports: pkg.exports,
});

writeFileSync("lib/package.json", JSON.stringify(trimmed, null, 2) + "\n");
