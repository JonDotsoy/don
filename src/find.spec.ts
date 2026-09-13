import { describe, it, expect } from "bun:test";
import { DON } from "./don";
import { findAllDirectives, findDirective } from "./find";

describe("find", () => {
  const text = ""
    + "server {\n"
    + "  route /home\n"
    + "  route GET /api/user\n"
    + "  route POST /api/user\n"
    + "  route /admin /api/user\n"
    + "}\n";

  const root = DON.parse(text);

  it("returns the document root for \"/\"", () => {
    expect(findDirective(root, "/")).toBe(root);
    expect(findAllDirectives(root, "/")).toEqual([root]);
  });

  it("returns the directive named by a single-segment path", () => {
    const directive = findDirective(root, "/server");

    expect(directive).toBe(root);
  });

  it("returns every child directive matching a two-segment path", () => {
    const directives = findAllDirectives(root, "/server/route");

    expect(directives).toHaveLength(4);
    expect(directives.every((directive) => directive.name === "route")).toBe(
      true,
    );
  });

  it("filters by an exact first argument", () => {
    const directive = findDirective(root, "/server/route(/home)");

    expect(directive?.args).toEqual(["/home"]);
  });

  it("filters with a wildcard first argument and an exact second argument", () => {
    const directives = findAllDirectives(root, "/server/route(* /api/user)");

    expect(directives).toHaveLength(3);
    expect(directives.map((directive) => directive.args)).toEqual([
      ["GET", "/api/user"],
      ["POST", "/api/user"],
      ["/admin", "/api/user"],
    ]);
  });

  it("returns undefined/empty when nothing matches", () => {
    expect(findDirective(root, "/server/missing")).toBeUndefined();
    expect(findAllDirectives(root, "/server/missing")).toEqual([]);
  });

  it("does not match a directive when the argument count differs", () => {
    const directives = findAllDirectives(root, "/server/route(/home /extra)");

    expect(directives).toEqual([]);
  });
});
