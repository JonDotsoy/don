import { describe, it, expect, mock } from "bun:test";
import { DON } from "./don";
import { atDirective, findAllDirectives, findDirective } from "./find";

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

  describe("Directive#find / Directive#findAll", () => {
    it("mirror findDirective/findAllDirectives, using `this` as the root", () => {
      expect(root.find("/server/route(/home)")).toEqual(
        findDirective(root, "/server/route(/home)"),
      );
      expect(root.findAll("/server/route(* /api/user)")).toEqual(
        findAllDirectives(root, "/server/route(* /api/user)"),
      );
    });
  });

  describe("atDirective / Directive#at", () => {
    it("returns the directive when the path has no trailing index", () => {
      expect(atDirective(root, "/server/route(/home)")).toEqual(
        findDirective(root, "/server/route(/home)"),
      );
    });

    it("returns the Nth argument when the path ends with [N]", () => {
      expect(atDirective(root, "/server/route(* /api/user)[0]")).toBe("GET");
      expect(atDirective(root, "/server/route(* /api/user)[1]")).toBe(
        "/api/user",
      );
    });

    it("returns undefined when the directive isn't found", () => {
      expect(atDirective(root, "/server/missing[0]")).toBeUndefined();
    });

    it("returns undefined when the argument index is out of range", () => {
      expect(atDirective(root, "/server/route(/home)[5]")).toBeUndefined();
    });

    it("Directive#at mirrors atDirective, using `this` as the root", () => {
      expect(root.at("/server/route(/home)")).toEqual(
        atDirective(root, "/server/route(/home)"),
      );
      expect(root.at("/server/route(* /api/user)[0]")).toBe(
        atDirective(root, "/server/route(* /api/user)[0]"),
      );
    });
  });

  describe("usage: registering routes on a mock server", () => {
    it("drives server.listen from route/header directives using findAll + at", () => {
      const routesText = ""
        + "server {\n"
        + "  route GET /home {\n"
        + "    header Content-Type text/html\n"
        + "  }\n"
        + "  route POST /api/user {\n"
        + "    header Authorization Bearer-token\n"
        + "    header Content-Type application/json\n"
        + "  }\n"
        + "}\n";

      const root = DON.parse(routesText);
      const server = { listen: mock(() => {}) };

      root.findAll("/server/route").map((route) => {
        const method = route.at("[0]");
        const path = route.at("[1]");
        const headers = Object.fromEntries(
          route.findAll("/route/header").map((h) => [h.at("[0]"), h.at("[1]")]),
        );

        server.listen({ method, path, headers });
      });

      expect(server.listen).toHaveBeenCalledTimes(2);
      expect(server.listen).toHaveBeenNthCalledWith(1, {
        method: "GET",
        path: "/home",
        headers: { "Content-Type": "text/html" },
      });
      expect(server.listen).toHaveBeenNthCalledWith(2, {
        method: "POST",
        path: "/api/user",
        headers: {
          Authorization: "Bearer-token",
          "Content-Type": "application/json",
        },
      });
    });
  });
});
