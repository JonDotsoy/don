import { describe, it, expect } from "bun:test";
import { DON } from "../don.js";
import { ROOT_DIRECTIVE_NAME } from "../root-directive-name.js";
import {
  createScopedVariablesPlugin,
  scopedVariablesPlugin,
} from "./scoped-variables-plugin.js";

describe("scopedVariablesPlugin", () => {
  it("scopes `set` to the block it runs in, without leaking into or out of sibling scopes", () => {
    const result = DON.parse(
      `
set foo 33

foo $foo
tar biz {
  set foo 55
  foo $foo
}
`,
      { plugins: [scopedVariablesPlugin] },
    );

    expect(result.name).toBe(ROOT_DIRECTIVE_NAME);
    const [foo, tar] = result.children;

    expect(foo!.name).toBe("foo");
    expect(foo!.args).toEqual([33]);

    expect(tar!.name).toBe("tar");
    expect(tar!.args).toEqual(["biz"]);
    expect(tar!.children).toHaveLength(1);
    expect(tar!.children[0]!.name).toBe("foo");
    expect(tar!.children[0]!.args).toEqual([55]);
  });

  it("restores the outer scope's value once a shadowing block ends", () => {
    const result = DON.parse(
      `
set foo 33

tar {
  set foo 55
  inner $foo
}

after $foo
`,
      { plugins: [scopedVariablesPlugin] },
    );

    const after = result.children.find((child) => child.name === "after");
    expect(after!.args).toEqual([33]);
  });

  it("interpolates ${name} inside a larger string, resolving to the value's stringified form", () => {
    const result = DON.parse(
      `
set project FOO

container "\${project}-container-1" {}
`,
      { plugins: [scopedVariablesPlugin] },
    );

    expect(result.name).toBe("container");
    expect(result.args).toEqual(["FOO-container-1"]);
  });

  it("resolves a bare $name argument to the variable's own value/type, not just a string", () => {
    const result = DON.parse("set port 8080\nlisten $port", {
      plugins: [scopedVariablesPlugin],
    });

    expect(result.name).toBe("listen");
    expect(result.args).toEqual([8080]);
  });

  it("leaves an unresolved $name or ${name} reference untouched", () => {
    const result = DON.parse('bob $foo "prefix-${bar}"', {
      plugins: [scopedVariablesPlugin],
    });

    expect(result.args).toEqual(["$foo", "prefix-${bar}"]);
  });

  it("lets nested blocks see an enclosing block's variables until they're shadowed", () => {
    const result = DON.parse(
      `
outer {
  set foo 1
  inner {
    seen $foo
    set foo 2
    seenAgain $foo
  }
  afterInner $foo
}
`,
      { plugins: [scopedVariablesPlugin] },
    );

    const inner = result.children.find((child) => child.name === "inner")!;
    const seen = inner.children.find((child) => child.name === "seen")!;
    const seenAgain = inner.children.find(
      (child) => child.name === "seenAgain",
    )!;
    const afterInner = result.children.find(
      (child) => child.name === "afterInner",
    )!;

    expect(seen.args).toEqual([1]);
    expect(seenAgain.args).toEqual([2]);
    expect(afterInner.args).toEqual([1]);
  });

  it("resolves a root-scope variable from a block nested 10 levels deep", () => {
    const DEPTH = 10;
    // level0 { level1 { ... level9 { deep $foo } ... } }
    const text =
      "set foo 33\n" +
      Array.from({ length: DEPTH }, (_, i) => `level${i} {\n`).join("") +
      "deep $foo\n" +
      "}\n".repeat(DEPTH);

    const result = DON.parse(text, { plugins: [scopedVariablesPlugin] });

    let directive = result;
    for (let i = 0; i < DEPTH; i++) {
      expect(directive.name).toBe(`level${i}`);
      directive = directive.children[0]!;
    }

    expect(directive.name).toBe("deep");
    expect(directive.args).toEqual([33]);
  });
});

describe("createScopedVariablesPlugin({ variables })", () => {
  it("seeds the root scope from a plain object, resolvable without a document-level `set`", () => {
    const plugin = createScopedVariablesPlugin({
      variables: { env: "prod", replicas: 3 },
    });

    const result = DON.parse("stage $env\nsize $replicas", {
      plugins: [plugin],
    });

    const [stage, size] = result.children;
    expect(stage!.args).toEqual(["prod"]);
    expect(size!.args).toEqual([3]);
  });

  it("seeds the root scope from a Map", () => {
    const plugin = createScopedVariablesPlugin({
      variables: new Map([["env", "staging"]]),
    });

    const result = DON.parse("stage $env", { plugins: [plugin] });

    expect(result.args).toEqual(["staging"]);
  });

  it("lets a document-level `set` shadow a seeded root variable inside a block, without mutating it back out", () => {
    const plugin = createScopedVariablesPlugin({
      variables: { env: "prod" },
    });

    const result = DON.parse(
      `
before $env
block {
  set env staging
  inside $env
}
after $env
`,
      { plugins: [plugin] },
    );

    const before = result.children.find((child) => child.name === "before")!;
    const block = result.children.find((child) => child.name === "block")!;
    const inside = block.children.find((child) => child.name === "inside")!;
    const after = result.children.find((child) => child.name === "after")!;

    expect(before.args).toEqual(["prod"]);
    expect(inside.args).toEqual(["staging"]);
    expect(after.args).toEqual(["prod"]);
  });

  it("defaults to no seeded variables, same as scopedVariablesPlugin", () => {
    const result = DON.parse("bob $foo", {
      plugins: [createScopedVariablesPlugin()],
    });

    expect(result.args).toEqual(["$foo"]);
  });

  it("scopedVariablesPlugin is createScopedVariablesPlugin() with no options", () => {
    const result = DON.parse("set foo 1\nbob $foo", {
      plugins: [scopedVariablesPlugin],
    });

    expect(result.args).toEqual([1]);
  });
});
