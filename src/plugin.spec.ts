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
