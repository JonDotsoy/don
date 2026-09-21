#!/usr/bin/env bun
// Package-manager helper for this repo. Run with `bun scripts/pm.ts <command>`.
//
// Commands:
//   pack   Pack the project into a .tgz (via `npm pack`, which runs the
//          `prepack` lifecycle: lint + build) and print its absolute path.

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { $ } from "bun";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

const usage = `Usage: bun scripts/pm.ts <command>

Commands:
  pack   Pack the project into a .tgz and print its absolute path`;

const pack = async (): Promise<number> => {
  console.log(`==> Packing ${repoRoot} (npm pack runs prepack: lint + build)`);
  const output = await $`npm pack ./`.cwd(repoRoot).text();

  const tarballName = output.trim().split("\n").pop();
  if (!tarballName) {
    throw new Error("npm pack did not produce a .tgz file");
  }

  console.log(join(repoRoot, tarballName));
  return 0;
};

const main = async (): Promise<number> => {
  const [command] = process.argv.slice(2);

  switch (command) {
    case "pack":
      return pack();
    default:
      console.error(usage);
      return 1;
  }
};

main()
  .then((exitCode) => {
    process.exitCode = exitCode;
  })
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
