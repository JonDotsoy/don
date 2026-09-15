import { describe, it, expect, mock } from "bun:test";
import { DON, HeredocValue, type Directive } from "./don";
import { atDirective, findAllDirectives, findDirective } from "./find";

// Compile-time only: never executed, just checked by `tsc`. Confirms
// `at`/`atDirective` narrow their return type based on whether the path
// literal ends in `[N]` (an argument value) or not (a Directive).
function typeAssertions(directive: Directive) {
  const argType: string | number | boolean | HeredocValue | undefined =
    directive.at("/server/route(/home)[1]");
  const directiveType: Directive | undefined = directive.at(
    "/server/route(/home)",
  );
  const dynamicPath: string = "/server/route(/home)";
  const dynamicType: string | number | boolean | HeredocValue | Directive | undefined =
    directive.at(dynamicPath);

  const fnArgType: string | number | boolean | HeredocValue | undefined =
    atDirective(directive, "/server/route(/home)[1]");
  const fnDirectiveType: Directive | undefined = atDirective(
    directive,
    "/server/route(/home)",
  );

  // @ts-expect-error a `[N]`-suffixed path never resolves to a Directive.
  const notADirective: Directive = directive.at("/server/route(/home)[1]");

  // @ts-expect-error a plain path never resolves to a raw argument value.
  const notAnArg: string = directive.at("/server/route(/home)");

  void argType;
  void directiveType;
  void dynamicType;
  void fnArgType;
  void fnDirectiveType;
  void notADirective;
  void notAnArg;
}
void typeAssertions;

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

  describe("escaping a `/` that's part of a directive's own name", () => {
    const slashText = ""
      + "server {\n"
      + "  /user {\n"
      + "    respond 200\n"
      + "  }\n"
      + "}\n";

    const slashRoot = DON.parse(slashText);

    it("resolves a directive named `/user` via `\\/user`", () => {
      const directive = findDirective(slashRoot, "/server/\\/user");

      expect(directive?.name).toBe("/user");
    });

    it("resolves a descendant of that directive", () => {
      const directive = findDirective(slashRoot, "/server/\\/user/respond");

      expect(directive?.args).toEqual([200]);
    });

    it("does not match without the escape", () => {
      expect(findDirective(slashRoot, "/server/user")).toBeUndefined();
    });

    it("also unescapes an arg pattern's `/`, though it's redundant there since `(...)` already isn't split on `/`", () => {
      const directive = findDirective(root, "/server/route(\\/home)");

      expect(directive?.args).toEqual(["/home"]);
    });
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

    it("returns the argument at position N when the path ends with [N] (1-based)", () => {
      expect(atDirective(root, "/server/route(* /api/user)[1]")).toBe("GET");
      expect(atDirective(root, "/server/route(* /api/user)[2]")).toBe(
        "/api/user",
      );
    });

    it("returns undefined when the directive isn't found", () => {
      expect(atDirective(root, "/server/missing[1]")).toBeUndefined();
    });

    it("returns undefined when the argument position is out of range", () => {
      expect(atDirective(root, "/server/route(/home)[5]")).toBeUndefined();
    });

    it("returns undefined for position [0] — positions are 1-based", () => {
      expect(atDirective(root, "/server/route(/home)[0]")).toBeUndefined();
    });

    it("Directive#at mirrors atDirective, using `this` as the root", () => {
      expect(root.at("/server/route(/home)")).toEqual(
        atDirective(root, "/server/route(/home)"),
      );
      expect(root.at("/server/route(* /api/user)[1]")).toBe(
        atDirective(root, "/server/route(* /api/user)[1]"),
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
      const server = {
        listen: mock(
          (_call: {
            method: unknown;
            path: unknown;
            headers: Record<string, unknown>;
          }) => {},
        ),
      };

      root.findAll("/server/route").map((route) => {
        const method = route.at("[1]");
        const path = route.at("[2]");
        const headers = Object.fromEntries(
          route.findAll("/route/header").map((h) => [h.at("[1]"), h.at("[2]")]),
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
