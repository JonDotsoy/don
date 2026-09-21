#!/usr/bin/env bun
// Package-prep CLI, run as `bun run scripts/pm.ts <command>`.
//
// pack: compiles src/ into lib/ and writes a standalone lib/package.json
//   next to it, so lib/ can be packed or published directly
//   (`npm pack ./lib`) as its own package root: every "./lib/..." path
//   becomes "./...", and fields only meaningful in the dev workspace
//   (scripts, devDependencies, files) are dropped.
import { cp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

const REPO_ROOT = new URL("..", import.meta.url).pathname;
const LIB_DIR = join(REPO_ROOT, "lib");

const run = (cmd: string[]) => {
  const proc = Bun.spawnSync(cmd, {
    cwd: REPO_ROOT,
    stdout: "inherit",
    stderr: "inherit",
  });
  if (proc.exitCode !== 0) {
    throw new Error(`Command failed (exit ${proc.exitCode}): ${cmd.join(" ")}`);
  }
};

const stripLibPrefix = (value: unknown): unknown =>
  typeof value === "string" ? value.replace(/^\.\/lib\//, "./") : value;

const rewritePaths = (value: unknown): unknown => {
  if (typeof value === "string") return stripLibPrefix(value);
  if (Array.isArray(value)) return value.map(rewritePaths);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [
        k,
        rewritePaths(v),
      ]),
    );
  }
  return value;
};

async function pack() {
  await rm(LIB_DIR, { recursive: true, force: true });

  console.log("==> Compiling src/ into lib/");
  run([join(REPO_ROOT, "node_modules/.bin/tsc"), "-p", "tsconfig.esm.json"]);

  console.log("==> Copying build assets");
  const certsSrcDir = join(REPO_ROOT, "src/demo/proxy/certs");
  const certsOutDir = join(LIB_DIR, "demo/proxy/certs");
  await mkdir(certsOutDir, { recursive: true });
  for (const file of await readdir(certsSrcDir)) {
    if (file.endsWith(".pem")) {
      await cp(join(certsSrcDir, file), join(certsOutDir, file));
    }
  }

  console.log("==> Writing lib/package.json");
  const pkg = JSON.parse(
    await readFile(join(REPO_ROOT, "package.json"), "utf8"),
  );
  const { scripts, devDependencies, files, ...rest } = pkg;
  const trimmed = rewritePaths(rest);
  await writeFile(
    join(LIB_DIR, "package.json"),
    JSON.stringify(trimmed, null, 2) + "\n",
  );

  console.log("lib/ ready.");
}

const [, , command] = process.argv;

switch (command) {
  case "pack":
    await pack();
    break;
  default:
    console.error("Usage: bun run scripts/pm.ts <pack>");
    process.exit(1);
}
