import { describe, expect, it } from "bun:test";
import { SpecDocument } from "./document.ts";
import { jsFormatter, jsonFormatter } from "./formatters.ts";

describe("SpecDocument", () => {
  it("records mdLine calls in order", () => {
    const doc = new SpecDocument();

    doc.mdLine`# Title`;
    doc.mdLine`Some paragraph.`;

    expect(doc.fragments).toEqual(["# Title", "Some paragraph."]);
    expect(doc.toMarkdown()).toBe("# Title\n\nSome paragraph.\n");
  });

  it("interpolates values inside mdLine", () => {
    const doc = new SpecDocument();
    const name = "DON";

    doc.mdLine`Hello ${name}, version ${1}`;

    expect(doc.fragments).toEqual(["Hello DON, version 1"]);
  });

  it("renders a block({ key, lang }) as a fenced code block", () => {
    const doc = new SpecDocument();

    doc.block({ key: "sample1", lang: "don" })`
name "john"
`;

    expect(doc.fragments).toEqual(['```don\nname "john"\n```']);
  });

  it("evaluates a stored block with block({ evalBlock, format })", () => {
    const doc = new SpecDocument();

    doc.block({ key: "sample1", lang: "don" })`
name "john"
`;
    doc.block({ evalBlock: "sample1", format: "js" });

    expect(doc.fragments).toEqual([
      '```don\nname "john"\n```',
      '```js\nnew Directive("name", ["john"], []);\n```',
    ]);
  });

  it("throws when evalBlock references an unknown key", () => {
    const doc = new SpecDocument();

    expect(() => doc.block({ evalBlock: "missing", format: "js" })).toThrow(/no stored block/);
  });

  it("throws when evalBlock references an unknown format", () => {
    const doc = new SpecDocument();

    doc.block({ key: "sample1", lang: "don" })`foo`;

    expect(() => doc.block({ evalBlock: "sample1", format: "yaml" })).toThrow(/no formatter registered/);
  });

  it("supports custom formatters", () => {
    const doc = new SpecDocument({ shout: (raw) => raw.toUpperCase() });

    doc.block({ key: "sample1", lang: "don" })`foo bar`;
    doc.block({ evalBlock: "sample1", format: "shout" });

    expect(doc.fragments.at(-1)).toBe("```shout\nFOO BAR\n```");
  });

  it("resolves tableOfContents() against headings emitted after it, in toMarkdown()", () => {
    const doc = new SpecDocument();

    doc.mdLine`# DON Specification v1`;
    doc.tableOfContents();
    doc.mdLine`## 1. Overview`;
    doc.mdLine`## 1.1 DON vs JSON`;

    expect(doc.toMarkdown()).toBe(
      ""
      + "# DON Specification v1\n"
      + "\n"
      + "- [1. Overview](#1-overview)\n"
      + "- [1.1 DON vs JSON](#11-don-vs-json)\n"
      + "\n"
      + "## 1. Overview\n"
      + "\n"
      + "## 1.1 DON vs JSON\n",
    );
  });

  it("keeps the unresolved placeholder in the raw fragments list", () => {
    const doc = new SpecDocument();

    doc.mdLine`# Title`;
    doc.tableOfContents();

    expect(doc.fragments.at(-1)).not.toBe("");
    expect(doc.fragments).toHaveLength(2);
  });

  it("returns a no-op tag function from block({ evalBlock, format })", () => {
    const doc = new SpecDocument();
    doc.block({ key: "sample1", lang: "don" })`foo`;

    const tag = doc.block({ evalBlock: "sample1", format: "js" });

    expect(typeof tag).toBe("function");
    expect(() => tag``).not.toThrow();
    expect(doc.fragments).toHaveLength(2); // no extra fragment from calling the stub
  });
});

describe("jsFormatter", () => {
  it("renders a single directive as new Directive(...)", () => {
    expect(jsFormatter('name "john"')).toBe('new Directive("name", ["john"], []);');
  });

  it("renders nested directives recursively", () => {
    expect(
      jsFormatter(""
        + "dependencies {\n"
        + '  zod ">=1"\n'
        + "}\n"
      ),
    ).toBe('new Directive("dependencies", [], [new Directive("zod", [">=1"], [])]);');
  });

  it("renders multiple top-level directives on separate lines", () => {
    expect(jsFormatter('a 1\nb 2')).toBe(
      'new Directive("a", [1], []);\nnew Directive("b", [2], []);',
    );
  });
});

describe("jsonFormatter", () => {
  it("renders a single-arg directive as a scalar", () => {
    expect(JSON.parse(jsonFormatter('port 8080'))).toEqual({ port: 8080 });
  });

  it("renders a directive with children as a nested object", () => {
    const json = JSON.parse(
      jsonFormatter(""
        + "dependencies {\n"
        + '  zod ">=1"\n'
        + '  react ">=5"\n'
        + "}\n"
      ),
    );

    expect(json).toEqual({ dependencies: { zod: ">=1", react: ">=5" } });
  });

  it("collapses repeated directive names into an array", () => {
    const json = JSON.parse(jsonFormatter('route /a\nroute /b'));

    expect(json).toEqual({ route: ["/a", "/b"] });
  });

  it("renders an argument-less directive as true", () => {
    expect(JSON.parse(jsonFormatter("ssl"))).toEqual({ ssl: true });
  });
});
