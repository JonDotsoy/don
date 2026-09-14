import { describe, test, expect } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const BIN_PATH = new URL("./donly.ts", import.meta.url).pathname;

const runCli = async (args: string[], cwd: string) => {
  const proc = Bun.spawn(["bun", BIN_PATH, ...args], {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  return { stdout, stderr, exitCode };
};

describe("donly lint", () => {
  test("exits 0 and reports no issues for a valid file", async () => {
    const dir = await mkdtemp(join(tmpdir(), "donly-cli-"));
    try {
      await writeFile(
        join(dir, "rules.json"),
        JSON.stringify({
          "/server/port": {
            "[1]": { type: "number", message: "port must be a number" },
          },
        }),
      );
      await writeFile(join(dir, "file.donly"), "server {\n  port 3000\n}\n");

      const { stdout, exitCode } = await runCli(
        ["lint", "--rules", "rules.json", "file.donly"],
        dir,
      );

      expect(exitCode).toBe(0);
      expect(stdout).toBe("file.donly\n\n0 errors 0 warnings 0 info\n");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("exits 1 and reports issues for an invalid file", async () => {
    const dir = await mkdtemp(join(tmpdir(), "donly-cli-"));
    try {
      await writeFile(
        join(dir, "rules.json"),
        JSON.stringify({
          "/server/port": {
            "[1]": { type: "number", message: "port must be a number" },
          },
        }),
      );
      await writeFile(join(dir, "file.donly"), 'server {\n  port "3000"\n}\n');

      const { stdout, exitCode } = await runCli(
        ["lint", "--rules", "rules.json", "file.donly"],
        dir,
      );

      expect(exitCode).toBe(1);
      expect(stdout).toContain("port must be a number");
      expect(stdout).toContain("1 error 0 warnings 0 info");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("prints usage and exits 1 for an unknown command", async () => {
    const dir = await mkdtemp(join(tmpdir(), "donly-cli-"));
    try {
      const { stderr, exitCode } = await runCli(["unknown"], dir);

      expect(exitCode).toBe(1);
      expect(stderr).toContain("Usage: donly lint");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
