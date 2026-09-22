import { describe, it, expect } from "bun:test";
import { DON } from "./don.js";
import { inspect } from "./utils.js";

describe("inspect", () => {
  it("defaults to the nested strategy", () => {
    const directive = DON.parse("server {\n  port 3000\n}\n");

    expect(inspect(directive)).toEqual({ server: { port: 3000 } });
  });

  it("supports the tuple strategy", () => {
    const directive = DON.parse("route /home GET\n");

    expect(inspect(directive, "tuple")).toEqual({ route: ["/home", "GET"] });
  });

  it("supports the raw strategy", () => {
    const directive = DON.parse("name value\n");

    expect(inspect(directive, "raw")).toEqual([
      { name: "name", args: ["value"], children: [] },
    ]);
  });

  it("accepts an array of Directives", () => {
    const document = DON.parse("a 1\nb 2\n");

    expect(inspect(document.children)).toEqual({ a: 1, b: 2 });
  });
});
