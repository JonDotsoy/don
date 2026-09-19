import { describe, it, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DON, Directive } from "../don.js";
import { DirectiveJSONEncoder } from "../directive-json.js";

const dir = new URL(".", import.meta.url).pathname;

// A CI/CD-style pipeline: several jobs (identified with bracket
// identifiers), dependencies between them via `needs`, conditional
// execution via `if`, parallel processes via `matrix`, and each job
// declaring `outputs` consumed by downstream jobs.
const pipeline = readFileSync(
  join(dir, "workflow-example.donly"),
  "utf8",
);

const findChild = (directive: Directive, name: string) =>
  directive.children.find((child) => child.name === name);

const findChildren = (directive: Directive, name: string) =>
  directive.children.filter((child) => child.name === name);

describe("donly/demo workflow example", () => {
  it("parses the whole pipeline into a single root directive", () => {
    const root = DON.parse(pipeline);

    expect(root).toBeInstanceOf(Directive);
    expect(root.name).toBe("workflow");
    expect(root.args).toEqual(["release"]);
  });

  it("parses the trigger and global env block", () => {
    const root = DON.parse(pipeline);

    const on = findChild(root, "on");
    expect(on?.args).toEqual(["push"]);
    expect(findChild(on!, "branches")?.args).toEqual(["main"]);

    const env = findChild(root, "env");
    expect(env?.children.map((c) => [c.name, c.args])).toEqual([
      ["REGISTRY", ["registry.example.com"]],
      ["NODE_ENV", ["production"]],
    ]);
  });

  it("identifies each job by its bracketed identifier", () => {
    const root = DON.parse(pipeline);

    const jobs = root.children.filter((child) =>
      /^job-\[.+\]$/.test(String(child.name)),
    );

    expect(jobs.map((job) => job.name)).toEqual([
      "job-[lint]",
      "job-[build]",
      "job-[deploy-staging]",
      "job-[deploy-production]",
    ]);
  });

  it("chains jobs together with `needs`", () => {
    const root = DON.parse(pipeline);

    const build = findChild(root, "job-[build]")!;
    const deployStaging = findChild(root, "job-[deploy-staging]")!;
    const deployProduction = findChild(root, "job-[deploy-production]")!;

    expect(findChild(build, "needs")?.args).toEqual(["lint"]);
    expect(findChild(deployStaging, "needs")?.args).toEqual(["build"]);
    expect(findChild(deployProduction, "needs")?.args).toEqual([
      "build",
      "deploy-staging",
    ]);
  });

  it("gates deploy jobs behind an `if` condition referencing another job's outputs", () => {
    const root = DON.parse(pipeline);

    const deployStaging = findChild(root, "job-[deploy-staging]")!;
    const deployProduction = findChild(root, "job-[deploy-production]")!;

    expect(findChild(deployStaging, "if")?.args).toEqual([
      "${job-[build].outputs.version} != ''",
    ]);
    expect(findChild(deployProduction, "if")?.args).toEqual([
      "${on.push.branches} == 'main'",
    ]);
  });

  it("runs a matrix of parallel processes for the build job", () => {
    const root = DON.parse(pipeline);

    const build = findChild(root, "job-[build]")!;
    const matrix = findChild(build, "matrix")!;

    expect(findChild(matrix, "os")?.args).toEqual([
      "ubuntu-latest",
      "macos-latest",
      "windows-latest",
    ]);
    expect(findChild(matrix, "node")?.args).toEqual([18, 20, 22]);
  });

  it("runs multiple sequential processes per job via `run` steps", () => {
    const root = DON.parse(pipeline);

    const build = findChild(root, "job-[build]")!;
    const steps = findChild(build, "steps")!;

    expect(findChildren(steps, "run").map((r) => r.args)).toEqual([
      ["npm ci"],
      ["npm run build"],
      ["npm run test"],
    ]);
  });

  it("declares outputs each downstream job can reference", () => {
    const root = DON.parse(pipeline);

    const build = findChild(root, "job-[build]")!;
    const outputs = findChild(build, "outputs")!;

    expect(outputs.children.map((c) => [c.name, c.args])).toEqual([
      ["version", ["${steps.build.version}"]],
      ["artifact", ["${steps.build.artifact_path}"]],
    ]);
  });

  it("round-trips the whole pipeline through the DirectiveJSONEncoder", () => {
    const root = DON.parse(pipeline);
    const value = DirectiveJSONEncoder.encode(root, { reducer: null });

    expect(Array.isArray(value)).toBe(true);
    const [workflow] = value as any[];
    expect(workflow.name).toBe("workflow");
    expect(workflow.args).toEqual(["release"]);

    const jobNames = workflow.children
      .filter((c: any) => /^job-\[.+\]$/.test(c.name))
      .map((c: any) => c.name);
    expect(jobNames).toEqual([
      "job-[lint]",
      "job-[build]",
      "job-[deploy-staging]",
      "job-[deploy-production]",
    ]);
  });
});
