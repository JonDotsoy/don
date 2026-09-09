import { afterAll, describe, expect, it } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { generateSpec } from "./run.ts";

const fixture = (name: string) => path.join(import.meta.dir, "__fixtures__", name);

describe("generateSpec", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "spec-generator-"));

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("writes the compiled markdown to the given output path", async () => {
    const output = path.join(tmpDir, "fixture-basic.md");

    const { markdown } = await generateSpec(fixture("fixture-basic.ts"), output);

    expect(fs.existsSync(output)).toBe(true);
    expect(fs.readFileSync(output, "utf8")).toBe(markdown);
    expect(markdown).toContain("# Fixture Spec");
    expect(markdown).toContain('new Directive("name", ["john"], []);');
  });

  it("defaults the output path by replacing _generator_specs.ts with spec.generated.md", async () => {
    const input = path.join(tmpDir, "nested", "_generator_specs.ts");
    fs.mkdirSync(path.dirname(input), { recursive: true });
    fs.copyFileSync(fixture("fixture-basic.ts"), input);

    const { output } = await generateSpec(input);

    expect(output).toBe(path.join(tmpDir, "nested", "spec.generated.md"));
    expect(fs.existsSync(output)).toBe(true);
  });

  it("compiles the real docs/specs/v1/_generator_specs.ts end to end", async () => {
    const output = path.join(tmpDir, "real-spec.md");
    const generatorPath = path.join(import.meta.dir, "..", "..", "docs", "specs", "v1", "_generator_specs.ts");

    const { markdown } = await generateSpec(generatorPath, output);

    expect(markdown.startsWith("---\ntitle: DON Specification v1")).toBe(true);
    expect(markdown).toContain("> **Status**: Draft");
    expect(markdown).toContain('new Directive("name", ["john"], []);');
    expect(markdown).toContain(
      'new Directive("dependencies", [], [new Directive("zod", [">=1"], []), new Directive("react", [">=5"], [])]);',
    );
    expect(markdown).toContain('"dependencies": {\n    "zod": ">=1",\n    "react": ">=5"\n  }');
  });
});
