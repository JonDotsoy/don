import { describe, it, expect } from "bun:test";
import { DON } from "../../don.js";
import { ROOT_DIRECTIVE_NAME } from "../../root-directive-name.js";
import { scopedVariablesPlugin } from "./scoped-variables-plugin.js";

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
});
