#!/usr/bin/env bun
// Package-manager helper for this repo. Run with `bun scripts/pm.ts <command>`.
//
// Commands:
//   pack   Pack the project into a .tgz (via `npm pack`, which runs the
//          `prepack` lifecycle: lint + build), install it as a real
//          dependency in a scratch project, and execute the packed
//          `donly` CLI against it to confirm the tarball actually works.

import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { $ } from "bun";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

const usage = `Usage: bun scripts/pm.ts <command>

Commands:
  pack   Pack the project into a .tgz and execute it against a scratch install`;

const pack = async (): Promise<number> => {
  const workDir = await mkdtemp(join(tmpdir(), "don-pm-pack-"));

  try {
    console.log(
      `==> Packing ${repoRoot} (npm pack runs prepack: lint + build)`,
    );
    await $`npm pack --pack-destination ${workDir}`.cwd(repoRoot).quiet();

    const tarballName = (await readdir(workDir)).find((file) =>
      file.endsWith(".tgz"),
    );
    if (!tarballName) {
      throw new Error("npm pack did not produce a .tgz file");
    }
    const tarballPath = join(workDir, tarballName);
    console.log(`==> Packed: ${tarballPath}`);

    const projectDir = join(workDir, "project");
    await $`mkdir -p ${projectDir}`;
    await $`npm init -y`.cwd(projectDir).quiet();

    console.log("==> Installing the packed tarball as a real dependency");
    await $`npm install ${tarballPath} --silent`.cwd(projectDir).quiet();

    const sampleFile = join(projectDir, "sample.donly");
    await Bun.write(sampleFile, `server {\n  port "3000"\n}\n`);

    console.log(
      "==> Executing the packed tarball (bunx donly inspect sample.donly)",
    );
    const output = await $`bunx donly inspect sample.donly`
      .cwd(projectDir)
      .text();
    process.stdout.write(output);

    console.log(`==> Packed tarball executed successfully: ${tarballPath}`);
    return 0;
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
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
