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

const rulesDocument = {
  "/server/port": {
    "[1]": { type: "number", message: "port must be a number" },
  },
};

const withFixtures = async (
  fn: (dir: string) => Promise<void>,
): Promise<void> => {
  const dir = await mkdtemp(join(tmpdir(), "donly-cli-"));
  try {
    await writeFile(join(dir, "rules.json"), JSON.stringify(rulesDocument));
    await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
};

describe("donly lint", () => {
  test("exits 0 and reports no issues for a valid file", () =>
    withFixtures(async (dir) => {
      await writeFile(join(dir, "file.donly"), "server {\n  port 3000\n}\n");

      const { stdout, exitCode } = await runCli(
        ["lint", "--rules", "rules.json", "file.donly"],
        dir,
      );

      expect(exitCode).toBe(0);
      expect(stdout).toBe("file.donly\n\n0 errors 0 warnings 0 info\n");
    }));

  test("exits 1 and reports issues for an invalid file", () =>
    withFixtures(async (dir) => {
      await writeFile(join(dir, "file.donly"), 'server {\n  port "3000"\n}\n');

      const { stdout, exitCode } = await runCli(
        ["lint", "--rules", "rules.json", "file.donly"],
        dir,
      );

      expect(exitCode).toBe(1);
      expect(stdout).toContain("port must be a number");
      expect(stdout).toContain("1 error 0 warnings 0 info");
    }));

  test("--output json prints a JSONReport and exits 1 on errors", () =>
    withFixtures(async (dir) => {
      await writeFile(join(dir, "file.donly"), 'server {\n  port "3000"\n}\n');

      const { stdout, exitCode } = await runCli(
        ["lint", "--rules", "rules.json", "--output", "json", "file.donly"],
        dir,
      );

      expect(exitCode).toBe(1);
      const report = JSON.parse(stdout);
      expect(report).toEqual({
        filePath: "file.donly",
        issues: [
          {
            line: 2,
            column: 8,
            severity: "error",
            message: "port must be a number",
          },
        ],
        summary: { errors: 1, warnings: 0, info: 0 },
      });
    }));

  test("-o json is equivalent to --output json", () =>
    withFixtures(async (dir) => {
      await writeFile(join(dir, "file.donly"), "server {\n  port 3000\n}\n");

      const { stdout, exitCode } = await runCli(
        ["lint", "--rules", "rules.json", "-o", "json", "file.donly"],
        dir,
      );

      expect(exitCode).toBe(0);
      expect(JSON.parse(stdout)).toEqual({
        filePath: "file.donly",
        issues: [],
        summary: { errors: 0, warnings: 0, info: 0 },
      });
    }));

  test("rejects an unknown --output value", () =>
    withFixtures(async (dir) => {
      await writeFile(join(dir, "file.donly"), "server {\n  port 3000\n}\n");

      const { stderr, exitCode } = await runCli(
        ["lint", "--rules", "rules.json", "--output", "yaml", "file.donly"],
        dir,
      );

      expect(exitCode).toBe(1);
      expect(stderr).toContain("Usage: donly lint");
    }));
});

describe("donly inspect", () => {
  const withDonlyFile = async (
    fn: (dir: string) => Promise<void>,
  ): Promise<void> => {
    const dir = await mkdtemp(join(tmpdir(), "donly-cli-"));
    try {
      await writeFile(
        join(dir, "file.donly"),
        'route /users GET {\n  respond 200 "Ok"\n}\n',
      );
      await fn(dir);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  };

  test("defaults to the nested strategy", () =>
    withDonlyFile(async (dir) => {
      const { stdout, exitCode } = await runCli(
        ["inspect", "file.donly"],
        dir,
      );

      expect(exitCode).toBe(0);
      expect(JSON.parse(stdout)).toEqual({
        route: { "/users": { GET: { respond: { "200": "Ok" } } } },
      });
    }));

  test("--strategy tuple keeps args as an array", () =>
    withDonlyFile(async (dir) => {
      const { stdout, exitCode } = await runCli(
        ["inspect", "--strategy", "tuple", "file.donly"],
        dir,
      );

      expect(exitCode).toBe(0);
      expect(JSON.parse(stdout)).toEqual({
        route: ["/users", "GET", { respond: [200, "Ok"] }],
      });
    }));

  test("-s raw returns the lossless {name, args, children} shape", () =>
    withDonlyFile(async (dir) => {
      const { stdout, exitCode } = await runCli(
        ["inspect", "-s", "raw", "file.donly"],
        dir,
      );

      expect(exitCode).toBe(0);
      expect(JSON.parse(stdout)).toEqual([
        {
          name: "route",
          args: ["/users", "GET"],
          children: [
            {
              name: "respond",
              args: [200, "Ok"],
              children: [],
            },
          ],
        },
      ]);
    }));

  test("rejects an unknown --strategy value", () =>
    withDonlyFile(async (dir) => {
      const { stderr, exitCode } = await runCli(
        ["inspect", "--strategy", "bogus", "file.donly"],
        dir,
      );

      expect(exitCode).toBe(1);
      expect(stderr).toContain("Usage: donly inspect");
    }));
});

describe("donly (unknown command)", () => {
  test("prints usage listing every command and exits 1", async () => {
    const dir = await mkdtemp(join(tmpdir(), "donly-cli-"));
    try {
      const { stderr, exitCode } = await runCli(["unknown"], dir);

      expect(exitCode).toBe(1);
      expect(stderr).toContain("Usage: donly <command>");
      expect(stderr).toContain("lint --rules");
      expect(stderr).toContain("inspect");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
