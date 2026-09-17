import { describe, it, expect } from "bun:test";
import { DON } from "../../don.js";
import { resolveScopedVariables } from "./scoped-variables-resolver.js";

describe("resolveScopedVariables", () => {
  it("resolves a bare $name to the value set at that scope, preserving its type", () => {
    const result = resolveScopedVariables(
      DON.parse(`
set foo 33

foo $foo
tar biz {
  set foo 55
  foo $foo
}
`),
    );

    // `set` was dropped, leaving 2 top-level directives (`foo`, `tar`),
    // so the result stays wrapped in a synthetic root — same rule
    // `DON.parse()` itself uses for "more than one top-level directive".
    expect(result.children).toHaveLength(2);

    const [foo, tar] = result.children;
    expect(foo).toMatchObject({ name: "foo", args: [33] });
    expect(tar!.name).toBe("tar");
    expect(tar!.args).toEqual(["biz"]);
    expect(tar!.children).toHaveLength(1);
    expect(tar!.children[0]!).toMatchObject({ name: "foo", args: [55] });
  });

  it("reverts a shadowed variable once the block that shadowed it ends", () => {
    const result = resolveScopedVariables(
      DON.parse(`
set foo 33

tar biz {
  set foo 55
}

after $foo
`),
    );

    const after = result.children.at(-1)!;
    expect(after.name).toBe("after");
    expect(after.args).toEqual([33]);
  });

  it("interpolates ${name} inside a larger string argument", () => {
    const result = resolveScopedVariables(
      DON.parse(`
set project "FOO"

container "\${project}-container-1" {}
`),
    );

    expect(result.name).toBe("container");
    expect(result.args).toEqual(["FOO-container-1"]);
  });

  it("leaves an escaped \\${name} as literal text, unresolved", () => {
    const result = resolveScopedVariables(
      DON.parse(`
set project "FOO"

label "literal \\\${project} here"
`),
    );

    expect(result.args).toEqual(["literal ${project} here"]);
  });

  it("throws on a bare $name with no matching set in scope", () => {
    expect(() => resolveScopedVariables(DON.parse("foo $bar"))).toThrow(
      /Unknown variable "\$bar"/,
    );
  });

  it("throws on a \\${name} template with no matching set in scope", () => {
    expect(() =>
      resolveScopedVariables(DON.parse('foo "${bar}"')),
    ).toThrow(/Unknown variable "\$\{bar\}"/);
  });

  it("drops `set` directives from the resulting tree", () => {
    const result = resolveScopedVariables(DON.parse("set foo 33\nkeep"));

    expect(result.name).toBe("keep");
  });
});
