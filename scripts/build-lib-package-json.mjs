#!/usr/bin/env node
// Writes lib/esm/package.json for the build, copying every field from the
// root package.json except main/types/exports (module resolution for the
// published package lives at the root, not inside lib/esm) and the fields
// that only make sense at the repo root (scripts, devDependencies, files).
// "bin" paths are rewritten relative to lib/esm/ instead of the repo root.

import { readFile, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const libEsmDir = join(repoRoot, "lib", "esm");

const rootPackageJson = JSON.parse(
  await readFile(join(repoRoot, "package.json"), "utf8"),
);

const { main, types, exports, scripts, devDependencies, files, ...rest } =
  rootPackageJson;

const bin = rest.bin
  ? Object.fromEntries(
      Object.entries(rest.bin).map(([name, binPath]) => [
        name,
        `./${relative(libEsmDir, join(repoRoot, binPath))}`,
      ]),
    )
  : undefined;

const libPackageJson = { ...rest, ...(bin ? { bin } : {}) };

await writeFile(
  join(libEsmDir, "package.json"),
  `${JSON.stringify(libPackageJson, null, 2)}\n`,
);
