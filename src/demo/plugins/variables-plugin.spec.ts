import { describe, it, expect } from "bun:test";
import { DON } from "../../don.js";
import { variablesPlugin } from "./variables-plugin.js";

describe("variablesPlugin", () => {
  it("resolves a $var argument to the value a `set` directive stored, and drops `set` from the tree", () => {
    const result = DON.parse(
      `
set foo 33

tar biz lol {
  bob $foo
}
`,
      { plugins: [variablesPlugin] },
    );

    expect(result.name).toBe("tar");
    expect(result.args).toEqual(["biz", "lol"]);
    expect(result.children).toHaveLength(1);
    expect(result.children[0]!.name).toBe("bob");
    expect(result.children[0]!.args).toEqual(["33"]);
  });

  it("reads the resolved variable back through a caller-supplied initContext", () => {
    const ctx = new Map<string, string>();

    DON.parse(
      `
set foo 33

tar biz lol {
  bob $foo
}
`,
      { plugins: [{ ...variablesPlugin, initContext: () => ctx }] },
    );

    expect(ctx.get("foo")).toBe("33");
  });

  it("leaves $-less arguments and directives without plugins untouched", () => {
    const result = DON.parse("bob $foo", { plugins: [variablesPlugin] });

    expect(result.args).toHaveLength(1);
    expect(result.args[0]).toBeUndefined();
  });

  it("does nothing without the plugin (the default DON.parse() behavior)", () => {
    const result = DON.parse("bob $foo");

    expect(result.args).toEqual(["$foo"]);
  });
});
