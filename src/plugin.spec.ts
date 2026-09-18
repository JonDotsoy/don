import { describe, it, expect } from "bun:test";
import { DON } from "./don.js";
import type { DonPlugin } from "./plugin.js";

describe("DonPlugin#onDirective immutability", () => {
  it("returns a new node to transform args, instead of mutating the one it's given", () => {
    const upper: DonPlugin = {
      name: "upper",
      onDirective(node) {
        return {
          name: node.name,
          args: node.args.map((arg) =>
            typeof arg === "string" ? arg.toUpperCase() : arg,
          ),
        };
      },
    };

    const result = DON.parse('greet "hi"', { plugins: [upper] });

    expect(result.args).toEqual(["HI"]);
  });

  it("returns null (not false) to drop a directive and its children", () => {
    const dropSet: DonPlugin = {
      name: "drop-set",
      onDirective(node) {
        if (node.name === "set") return null;
      },
    };

    const result = DON.parse("set foo 33\nkeep", { plugins: [dropSet] });

    expect(result.name).toBe("keep");
  });

  it("leaves node as-is when onDirective returns nothing", () => {
    const noop: DonPlugin = {
      name: "noop",
      onDirective() {
        // returns void
      },
    };

    const result = DON.parse("host localhost", { plugins: [noop] });

    expect(result.args).toEqual(["localhost"]);
  });

  it("threads a later plugin's onDirective off an earlier plugin's replacement node", () => {
    const appendA: DonPlugin = {
      name: "append-a",
      onDirective(node) {
        return { name: node.name, args: [...node.args, "a"] };
      },
    };
    const appendB: DonPlugin = {
      name: "append-b",
      onDirective(node) {
        return { name: node.name, args: [...node.args, "b"] };
      },
    };

    const result = DON.parse("tag", { plugins: [appendA, appendB] });

    expect(result.args).toEqual(["a", "b"]);
  });
});

describe("DonPlugin#afterChildren", () => {
  it("fires once per directive, after all of its children, in document order", () => {
    const seen: string[] = [];
    const plugin: DonPlugin = {
      name: "log-after-children",
      onDirective(node) {
        seen.push(`enter:${String(node.name)}`);
      },
      afterChildren(node) {
        seen.push(`exit:${String(node.name)}`);
      },
    };

    DON.parse("a\nb {\n  c\n  d\n}\ne", { plugins: [plugin] });

    expect(seen).toEqual([
      "enter:a",
      "exit:a",
      "enter:b",
      "enter:c",
      "exit:c",
      "enter:d",
      "exit:d",
      "exit:b",
      "enter:e",
      "exit:e",
    ]);
  });

  it("never fires for a directive dropped by onDirective returning null", () => {
    const seen: string[] = [];
    const plugin: DonPlugin = {
      name: "drop-set",
      onDirective(node) {
        if (node.name === "set") return null;
      },
      afterChildren(node) {
        seen.push(String(node.name));
      },
    };

    DON.parse("set foo 33\nkeep", { plugins: [plugin] });

    expect(seen).toEqual(["keep"]);
  });

  it("lets a plugin pop a scope it pushed in onDirective, restoring it after the block ends", () => {
    // A minimal push/pop scope stack: onDirective pushes a new frame for
    // this directive's own children, afterChildren pops it back off —
    // exactly the pattern a block-scoped `set` needs.
    const stack: Map<string, number>[] = [new Map()];
    const plugin: DonPlugin = {
      name: "scoped",
      onDirective(node) {
        const scope = stack.at(-1)!;
        if (node.name === "set") {
          const [name, value] = node.args;
          if (typeof name === "string" && typeof value === "number") {
            scope.set(name, value);
          }
          return null;
        }
        stack.push(new Map(scope));
        if (node.name === "read") {
          const [name] = node.args;
          return {
            name: node.name,
            args: [typeof name === "string" ? scope.get(name) ?? null : null],
          };
        }
      },
      afterChildren() {
        stack.pop();
      },
    };

    const result = DON.parse(
      `
set foo 33

read foo
tar {
  set foo 55
  read foo
}
read foo
`,
      { plugins: [plugin] },
    );

    const [first, tar, last] = result.children;
    expect(first!.args).toEqual([33]);
    expect(tar!.children[0]!.args).toEqual([55]);
    expect(last!.args).toEqual([33]);
  });
});

describe("DonPlugin ctx isolation", () => {
  it("leaves ctx undefined for a plugin that defines no initContext", () => {
    const seenCtx: unknown[] = [];
    const plugin: DonPlugin = {
      name: "no-context",
      onDirective(_node, ctx) {
        seenCtx.push(ctx);
      },
    };

    DON.parse("a\nb", { plugins: [plugin] });

    expect(seenCtx).toEqual([undefined, undefined]);
  });

  it("never shares ctx between two plugins", () => {
    const setter: DonPlugin<Map<string, unknown>> = {
      name: "setter",
      initContext: () => new Map(),
      onDirective(node, ctx) {
        if (node.name === "set") ctx.set("foo", node.args[0]);
      },
    };
    const reader: DonPlugin<Map<string, unknown>> = {
      name: "reader",
      initContext: () => new Map(),
      onDirective(node, ctx) {
        if (node.name === "read") {
          return {
            name: node.name,
            args: [
              (ctx.get("foo") as number | string | boolean | undefined) ??
                false,
            ],
          };
        }
      },
    };

    const result = DON.parse("set 33\nread", { plugins: [setter, reader] });

    // `reader` never sees `setter`'s variable — each plugin got its own,
    // unrelated `ctx`.
    expect(result.children[1]!.args).toEqual([false]);
  });

  it("lets a caller read a plugin's own ctx back through initContext, whatever shape it picks", () => {
    // `ctx` isn't required to be a `Map` — a plugin picks whatever shape
    // it needs. Here it's a plain mutable array.
    const seen: string[] = [];
    const collector: DonPlugin<string[]> = {
      name: "collector",
      initContext: () => seen,
      onDirective(node, ctx) {
        ctx.push(String(node.name));
      },
    };

    DON.parse("a\nb {\n  c\n}", { plugins: [collector] });

    // The caller supplied `seen` itself via `initContext`, so it can read
    // it straight afterward — no directive lookup needed.
    expect(seen).toEqual(["a", "b", "c"]);
  });

  it("calls initContext once per DON.parse() call, before any directive is visited", () => {
    let calls = 0;
    const plugin: DonPlugin<Map<string, unknown>> = {
      name: "seeded",
      initContext: () => {
        calls++;
        const ctx = new Map<string, unknown>();
        ctx.set("greeting", "hi");
        return ctx;
      },
      onDirective(node, ctx) {
        if (node.name === "read") {
          return { name: node.name, args: [ctx.get("greeting") as string] };
        }
      },
    };

    const result = DON.parse("a\nb {\n  c\n}\nread", { plugins: [plugin] });

    expect(calls).toBe(1);
    expect(result.children.at(-1)!.args).toEqual(["hi"]);
  });
});
