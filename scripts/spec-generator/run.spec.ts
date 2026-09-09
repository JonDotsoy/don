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
    expect(markdown).toContain("status: Draft");
    expect(markdown).toMatch(/generatedAt: \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/);
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
      'new Directive("dependencies", [], [new Directive("zod", [4], []), new Directive("react", [5], [])]);',
    );
    expect(markdown).toContain('"dependencies": {\n    "zod": 4,\n    "react": 5\n  }');
    expect(markdown).toContain(
      "- [1. Overview](#1-overview)\n  - [Design Goals](#design-goals)\n- [1.1 DON vs JSON](#11-don-vs-json)",
    );
    expect(markdown).toContain("### 2.4 Numbers");
    expect(markdown).toContain("### 3.5 Mixed Types");
  });

  it("renders the HTTP Router Configuration example and its evaluated JSON", async () => {
    const output = path.join(tmpDir, "router-spec.md");
    const generatorPath = path.join(import.meta.dir, "..", "..", "docs", "specs", "v1", "_generator_specs.ts");

    const { markdown } = await generateSpec(generatorPath, output);

    expect(markdown).toContain("**Example: HTTP Router Configuration**");
    expect(markdown).toContain(
      ""
      + "```don\n"
      + "server {\n"
      + "  router /users {\n"
      + '    respond 200 "Ok"\n'
      + "  }\n"
      + "  router /user/:user_id {\n"
      + '    respond 200 "Ok"\n'
      + "  }\n"
      + "  router /admin {\n"
      + '    respond 403 "Forbidden"\n'
      + "  }\n"
      + "}\n"
      + "```",
    );

    expect(markdown).toContain("**JSON equivalent (less intuitive)**:");
    expect(markdown).toContain(
      ""
      + "```json\n"
      + "{\n"
      + '  "server": {\n'
      + '    "router": [\n'
      + "      {\n"
      + '        "respond": [\n'
      + "          200,\n"
      + '          "Ok"\n'
      + "        ]\n"
      + "      },\n"
      + "      {\n"
      + '        "respond": [\n'
      + "          200,\n"
      + '          "Ok"\n'
      + "        ]\n"
      + "      },\n"
      + "      {\n"
      + '        "respond": [\n'
      + "          403,\n"
      + '          "Forbidden"\n'
      + "        ]\n"
      + "      }\n"
      + "    ]\n"
      + "  }\n"
      + "}\n"
      + "```",
    );
  });
});
