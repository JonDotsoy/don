import { describe, expect, it } from "bun:test";
import * as path from "node:path";
import { compileSpec } from "./compile.ts";
import { renderDocument } from "./render.ts";

const fixture = (name: string) => path.join(import.meta.dir, "__fixtures__", name);

describe("compileSpec", () => {
  it("collects frontmatter and body fragments from a generator file", async () => {
    const { meta, fragments } = await compileSpec(fixture("fixture-basic.ts"));

    expect(meta).toEqual({
      status: "Draft",
      title: "Fixture Spec",
      description: "A minimal fixture used to test the spec generator.",
      lang: "en",
    });

    expect(fragments).toEqual([
      "# Fixture Spec",
      "Some intro paragraph.",
      '```don\nname "john"\n```',
      '```js\nnew Directive("name", ["john"], []);\n```',
    ]);
  });

  it("does not leak mdLine/block onto globalThis after compiling", async () => {
    await compileSpec(fixture("fixture-basic.ts"));

    expect((globalThis as Record<string, unknown>).mdLine).toBeUndefined();
    expect((globalThis as Record<string, unknown>).block).toBeUndefined();
  });

  it("rejects a generator file missing required frontmatter exports", async () => {
    await expect(compileSpec(fixture("fixture-missing-export.ts"))).rejects.toThrow(
      /missing required export/,
    );
  });

  it("propagates errors from an evalBlock referencing an unregistered key", async () => {
    await expect(compileSpec(fixture("fixture-eval-error.ts"))).rejects.toThrow(/no stored block/);
  });

  it("re-runs the generator's top-level side effects on repeated compiles", async () => {
    const first = await compileSpec(fixture("fixture-basic.ts"));
    const second = await compileSpec(fixture("fixture-basic.ts"));

    expect(first.fragments.length).toBeGreaterThan(0);
    expect(second.fragments).toEqual(first.fragments);
  });
});

describe("compileSpec + renderDocument", () => {
  it("renders a full markdown document with the status line after the H1", async () => {
    const { meta, fragments } = await compileSpec(fixture("fixture-basic.ts"));
    const generatedAt = new Date("2026-01-02T03:04:05.000Z");
    const markdown = renderDocument(meta, fragments, generatedAt);

    expect(markdown).toBe(
      ""
      + "---\n"
      + "title: Fixture Spec\n"
      + "description: A minimal fixture used to test the spec generator.\n"
      + "lang: en\n"
      + "status: Draft\n"
      + "generatedAt: 2026-01-02T03:04:05.000Z\n"
      + "---\n"
      + "\n"
      + "# Fixture Spec\n"
      + "\n"
      + "> **Status**: Draft\n"
      + "\n"
      + "Some intro paragraph.\n"
      + "\n"
      + '```don\nname "john"\n```\n'
      + "\n"
      + '```js\nnew Directive("name", ["john"], []);\n```\n',
    );
  });

  it("defaults generatedAt to the current time when not provided", async () => {
    const { meta, fragments } = await compileSpec(fixture("fixture-basic.ts"));
    const before = Date.now();
    const markdown = renderDocument(meta, fragments);
    const after = Date.now();

    const match = markdown.match(/generatedAt: (.+)/);
    expect(match).not.toBeNull();
    const generatedAtMs = new Date(match![1]!).getTime();
    expect(generatedAtMs).toBeGreaterThanOrEqual(before);
    expect(generatedAtMs).toBeLessThanOrEqual(after);
  });
});
