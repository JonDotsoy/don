import { describe, it, expect } from "bun:test";
import { Directive } from "../don";
import { PathExpression, type PathNode } from "./path-expression";

const parts = (path: string): PathNode[] => PathExpression.parse(path).parts;

describe("PathExpression.parse", () => {
  it("parses the empty root path", () => {
    expect(parts("/")).toEqual([]);
  });

  it("parses a static literal segment", () => {
    expect(parts("/foo")).toEqual([
      { segment: { type: "literal", value: "foo" } },
    ]);
  });

  it("parses a full single-segment wildcard as an empty pattern", () => {
    expect(parts("/*")).toEqual([{ segment: { type: "pattern" } }]);
  });

  it("parses a prefix pattern", () => {
    expect(parts("/foo*")).toEqual([
      { segment: { type: "pattern", prefix: "foo" } },
    ]);
  });

  it("parses a suffix pattern", () => {
    expect(parts("/*bar")).toEqual([
      { segment: { type: "pattern", suffix: "bar" } },
    ]);
  });

  it("parses a prefix+suffix pattern", () => {
    expect(parts("/foo*biz")).toEqual([
      { segment: { type: "pattern", prefix: "foo", suffix: "biz" } },
    ]);
  });

  it("parses multiple intermediate wildcards as chunks", () => {
    expect(parts("/foo*biz*tar")).toEqual([
      {
        segment: {
          type: "pattern",
          prefix: "foo",
          chunks: ["biz"],
          suffix: "tar",
        },
      },
    ]);
  });

  it("unescapes a `\\/` so it's read as a literal `/` instead of a separator", () => {
    expect(parts("/\\/tar")).toEqual([
      { segment: { type: "literal", value: "/tar" } },
    ]);
  });

  it("parses a segment with literal arguments", () => {
    expect(parts("/foo(tar biz)")).toEqual([
      {
        segment: { type: "literal", value: "foo" },
        args: [
          [
            { type: "literal", value: "tar" },
            { type: "literal", value: "biz" },
          ],
        ],
      },
    ]);
  });

  it("parses a segment with complex/dynamic arguments", () => {
    expect(
      parts("/foo(* tar* *biz foo*viz *biz* foo*tar*viz*liz*)"),
    ).toEqual([
      {
        segment: { type: "literal", value: "foo" },
        args: [
          [
            { type: "pattern" },
            { type: "pattern", prefix: "tar" },
            { type: "pattern", suffix: "biz" },
            { type: "pattern", prefix: "foo", suffix: "viz" },
            { type: "pattern", chunks: ["biz"] },
            { type: "pattern", prefix: "foo", chunks: ["tar", "viz", "liz"] },
          ],
        ],
      },
    ]);
  });

  it("parses a segment with no arguments as a single empty args group", () => {
    expect(parts("/foo()")).toEqual([
      { segment: { type: "literal", value: "foo" }, args: [[]] },
    ]);
  });

  describe("stacking multiple `(...)` args groups", () => {
    it("collects each group into args, one entry per group", () => {
      expect(parts("/foo(GET)(text/*)")).toEqual([
        {
          segment: { type: "literal", value: "foo" },
          args: [
            [{ type: "literal", value: "GET" }],
            [{ type: "pattern", prefix: "text/" }],
          ],
        },
      ]);
    });
  });

  describe("`|` alternation on a single argument token", () => {
    it("parses an argument token with `|` into an OrNode, patterns included", () => {
      expect(parts("/foo(GET|POST api*|*admin)")).toEqual([
        {
          segment: { type: "literal", value: "foo" },
          args: [
            [
              {
                type: "or",
                options: [
                  { type: "literal", value: "GET" },
                  { type: "literal", value: "POST" },
                ],
              },
              {
                type: "or",
                options: [
                  { type: "pattern", prefix: "api" },
                  { type: "pattern", suffix: "admin" },
                ],
              },
            ],
          ],
        },
      ]);
    });
  });

  it("parses a multi-segment path combined with a wildcard", () => {
    expect(parts("/foo/*/tar")).toEqual([
      { segment: { type: "literal", value: "foo" } },
      { segment: { type: "pattern" } },
      { segment: { type: "literal", value: "tar" } },
    ]);
  });

  it("parses a multi-segment path combined with a pattern", () => {
    expect(parts("/foo*biz/lol")).toEqual([
      { segment: { type: "pattern", prefix: "foo", suffix: "biz" } },
      { segment: { type: "literal", value: "lol" } },
    ]);
  });

  describe("a trailing `{...}` nested-path group", () => {
    it("is parsed into contains, absent when there is no group", () => {
      expect(parts("/route")).toEqual([
        { segment: { type: "literal", value: "route" } },
      ]);
    });

    it("parses a bare name into contains as a list of one nested PathExpression", () => {
      expect(parts("/route{/auth}")).toEqual([
        {
          segment: { type: "literal", value: "route" },
          contains: [
            {
              parts: [{ segment: { type: "literal", value: "auth" } }],
            },
          ],
        },
      ]);
    });

    it("composes with a `(...)` args group on the same segment", () => {
      expect(parts("/route(GET){/auth(on)}")).toEqual([
        {
          segment: { type: "literal", value: "route" },
          args: [[{ type: "literal", value: "GET" }]],
          contains: [
            {
              parts: [
                {
                  segment: { type: "literal", value: "auth" },
                  args: [[{ type: "literal", value: "on" }]],
                },
              ],
            },
          ],
        },
      ]);
    });

    it("supports a multi-segment nested path", () => {
      expect(parts("/server{/route/auth}")).toEqual([
        {
          segment: { type: "literal", value: "server" },
          contains: [
            {
              parts: [
                { segment: { type: "literal", value: "route" } },
                { segment: { type: "literal", value: "auth" } },
              ],
            },
          ],
        },
      ]);
    });

    it("stacking multiple `{...}` groups collects each into contains, one entry per group", () => {
      expect(parts("/route{/auth}{/respond}")).toEqual([
        {
          segment: { type: "literal", value: "route" },
          contains: [
            { parts: [{ segment: { type: "literal", value: "auth" } }] },
            { parts: [{ segment: { type: "literal", value: "respond" } }] },
          ],
        },
      ]);
    });

    it("supports `|` alternation inside a group as alternatives on the nested expression", () => {
      const [node] = parts("/route{/auth(on)|/auth(strict)}");

      expect(node!.contains).toEqual([
        {
          parts: [
            {
              segment: { type: "literal", value: "auth" },
              args: [[{ type: "literal", value: "on" }]],
            },
          ],
          alternatives: [
            {
              parts: [
                {
                  segment: { type: "literal", value: "auth" },
                  args: [[{ type: "literal", value: "strict" }]],
                },
              ],
            },
          ],
        },
      ]);
    });
  });

  describe("a top-level `|` between whole paths", () => {
    it("parses into alternatives on the returned PathExpression", () => {
      expect(PathExpression.parse("/foo|/biz")).toEqual({
        parts: [{ segment: { type: "literal", value: "foo" } }],
        alternatives: [
          { parts: [{ segment: { type: "literal", value: "biz" } }] },
        ],
      });
    });

    it("supports more than two alternatives, and multi-segment paths", () => {
      expect(PathExpression.parse("/a/b|/c|/d/e")).toEqual({
        parts: [
          { segment: { type: "literal", value: "a" } },
          { segment: { type: "literal", value: "b" } },
        ],
        alternatives: [
          { parts: [{ segment: { type: "literal", value: "c" } }] },
          {
            parts: [
              { segment: { type: "literal", value: "d" } },
              { segment: { type: "literal", value: "e" } },
            ],
          },
        ],
      });
    });

    it("is absent for a path with no top-level `|`", () => {
      expect(PathExpression.parse("/foo").alternatives).toBeUndefined();
    });

    it("does not split a `|` inside a `(...)` or `{...}` group", () => {
      const expression = PathExpression.parse("/foo(a|b){/tar|/biz}");

      expect(expression.alternatives).toBeUndefined();
      expect(expression.parts[0]!.args).toEqual([
        [{ type: "or", options: [{ type: "literal", value: "a" }, { type: "literal", value: "b" }] }],
      ]);
    });
  });

  describe("PathExpression.parse(str | PathExpression)", () => {
    it("returns an already-parsed PathExpression unchanged", () => {
      const parsed = PathExpression.parse("/foo/*/tar");

      expect(PathExpression.parse(parsed)).toBe(parsed);
    });

    it("parsing the same string twice yields equal (but not the same) results", () => {
      const first = PathExpression.parse("/foo(tar biz)");
      const second = PathExpression.parse("/foo(tar biz)");

      expect(second).toEqual(first);
      expect(second).not.toBe(first);
    });
  });

  describe("a trailing `[N]` argument selector", () => {
    it("is parsed off into selectArgument, informative only", () => {
      expect(PathExpression.parse("/foo[1]")).toEqual({
        parts: [{ segment: { type: "literal", value: "foo" } }],
        selectArgument: 1,
      });
    });

    it("is absent when the path has no trailing [N]", () => {
      expect(PathExpression.parse("/foo").selectArgument).toBeUndefined();
    });

    it("still applies to the segment's own (...) args", () => {
      expect(PathExpression.parse("/foo(tar biz)[0]")).toEqual({
        parts: [
          {
            segment: { type: "literal", value: "foo" },
            args: [
              [
                { type: "literal", value: "tar" },
                { type: "literal", value: "biz" },
              ],
            ],
          },
        ],
        selectArgument: 0,
      });
    });
  });
});

/**
 * `PathExpression.match(directive, expression, positionSegment)` checks a
 * single `Directive` against the one `PathNode` at `expression.parts[positionSegment]`
 * — it doesn't walk `directive.children` or advance through the rest of
 * `parts` itself; that's left to whatever traversal calls it once per
 * level. A node's `segment` is matched against `directive.name`; when the
 * node also carries `args` (i.e. its source had a `(...)` group, even an
 * empty one), `directive.args` must have the same length and each
 * argument must match pairwise — a node with no `args` at all matches any
 * `directive.args`, ignoring them entirely.
 *
 * An expression with no parts at all — `"/"`, `""`, or a bare `[N]`
 * selector with nothing before it — imposes no constraint, so it always
 * matches, for any directive and any positionSegment (including one past
 * where `parts` would otherwise end).
 */
describe("PathExpression.match", () => {
  it.each(["/", "", "[1]", "/[1]"])(
    "always matches when the expression has no parts (%j)",
    (path: string) => {
      const expression = PathExpression.parse(path);

      expect(
        PathExpression.match(new Directive("anything", ["a", "b"]), expression, 0),
      ).toBe(true);
      expect(
        PathExpression.match(new Directive("route", []), expression, 5),
      ).toBe(true);
    },
  );

  it("matches a literal segment by directive name", () => {
    const directive = new Directive("route", []);
    const expression = PathExpression.parse("/route");

    expect(PathExpression.match(directive, expression, 0)).toBe(true);
  });

  it("does not match a different literal name", () => {
    const directive = new Directive("other", []);
    const expression = PathExpression.parse("/route");

    expect(PathExpression.match(directive, expression, 0)).toBe(false);
  });

  it("a bare wildcard segment matches any directive name", () => {
    const expression = PathExpression.parse("/*");

    expect(PathExpression.match(new Directive("route", []), expression, 0)).toBe(
      true,
    );
    expect(
      PathExpression.match(new Directive("anything", []), expression, 0),
    ).toBe(true);
  });

  it("a prefix pattern matches names starting with the prefix", () => {
    const expression = PathExpression.parse("/api*");

    expect(
      PathExpression.match(new Directive("api_users", []), expression, 0),
    ).toBe(true);
    expect(
      PathExpression.match(new Directive("user_api", []), expression, 0),
    ).toBe(false);
  });

  it("a suffix pattern matches names ending with the suffix", () => {
    const expression = PathExpression.parse("/*_users");

    expect(
      PathExpression.match(new Directive("api_users", []), expression, 0),
    ).toBe(true);
    expect(
      PathExpression.match(new Directive("users_api", []), expression, 0),
    ).toBe(false);
  });

  it("a prefix+suffix pattern requires both ends, any middle", () => {
    const expression = PathExpression.parse("/api*list");

    expect(
      PathExpression.match(new Directive("api_user_list", []), expression, 0),
    ).toBe(true);
    expect(
      PathExpression.match(new Directive("apilist", []), expression, 0),
    ).toBe(true);
    expect(
      PathExpression.match(new Directive("a_list", []), expression, 0),
    ).toBe(false);
  });

  it("a multi-chunk pattern requires prefix, chunks, and suffix in order", () => {
    const expression = PathExpression.parse("/foo*biz*tar");

    expect(
      PathExpression.match(new Directive("fooXbizYtar", []), expression, 0),
    ).toBe(true);
    expect(
      PathExpression.match(new Directive("foobartar", []), expression, 0),
    ).toBe(false);
    expect(
      PathExpression.match(new Directive("tarfoobiz", []), expression, 0),
    ).toBe(false);
  });

  it("a segment with no `(...)` matches regardless of the directive's args", () => {
    const expression = PathExpression.parse("/route");

    expect(
      PathExpression.match(
        new Directive("route", ["GET", "/api"]),
        expression,
        0,
      ),
    ).toBe(true);
  });

  it("an explicit empty `()` requires the directive to have no args", () => {
    const expression = PathExpression.parse("/route()");

    expect(PathExpression.match(new Directive("route", []), expression, 0)).toBe(
      true,
    );
    expect(
      PathExpression.match(new Directive("route", ["GET"]), expression, 0),
    ).toBe(false);
  });

  it("matches args pairwise, literal and pattern alike", () => {
    const expression = PathExpression.parse("/route(* /api*)");

    expect(
      PathExpression.match(
        new Directive("route", ["POST", "/api/user"]),
        expression,
        0,
      ),
    ).toBe(true);
    expect(
      PathExpression.match(
        new Directive("route", ["POST", "/other"]),
        expression,
        0,
      ),
    ).toBe(false);
  });

  it("does not match when the argument count differs", () => {
    const expression = PathExpression.parse("/route(GET /api)");

    expect(
      PathExpression.match(
        new Directive("route", ["GET", "/api", "extra"]),
        expression,
        0,
      ),
    ).toBe(false);
  });

  it("stringifies non-string args before matching a literal", () => {
    const expression = PathExpression.parse("/port(8080)");

    expect(
      PathExpression.match(new Directive("port", [8080]), expression, 0),
    ).toBe(true);
    expect(
      PathExpression.match(new Directive("port", [8081]), expression, 0),
    ).toBe(false);
  });

  it("returns false for a positionSegment past the end of parts", () => {
    const expression = PathExpression.parse("/route");

    expect(
      PathExpression.match(new Directive("route", []), expression, 5),
    ).toBe(false);
  });

  describe("a `{...}` nested-path filter", () => {
    it("matches a directive with a descendant satisfying the nested path", () => {
      const routeHome = new Directive("Route", ["home"], [
        new Directive("Auth", ["on"]),
      ]);
      const routeSettings = new Directive("Route", ["settings"], []);
      const expression = PathExpression.parse("/Route{/Auth(on)}");

      expect(PathExpression.match(routeHome, expression, 0)).toBe(true);
      expect(PathExpression.match(routeSettings, expression, 0)).toBe(false);
    });

    it("still returns the outer directive, not the nested match", () => {
      const auth = new Directive("Auth", ["on"]);
      const route = new Directive("Route", ["home"], [auth]);
      const expression = PathExpression.parse("/Route{/Auth(on)}");

      expect(PathExpression.match(route, expression, 0)).toBe(true);
    });

    it("looks past direct children when the nested path has multiple segments", () => {
      const auth = new Directive("Auth", ["on"]);
      const route = new Directive("Route", [], [auth]);
      const server = new Directive("Server", [], [route]);
      const expression = PathExpression.parse("/Server{/Route/Auth(on)}");

      expect(PathExpression.match(server, expression, 0)).toBe(true);
    });

    it("does not match when no descendant satisfies the nested path", () => {
      const route = new Directive("Route", [], [new Directive("Auth", ["off"])]);
      const expression = PathExpression.parse("/Route{/Auth(on)}");

      expect(PathExpression.match(route, expression, 0)).toBe(false);
    });

    it("does not match a directive with no children at all", () => {
      const route = new Directive("Route", []);
      const expression = PathExpression.parse("/Route{/Auth(on)}");

      expect(PathExpression.match(route, expression, 0)).toBe(false);
    });
  });

  describe("stacked `(...)` args groups (AND)", () => {
    it("matches only when the directive's args satisfy every group", () => {
      const expression = PathExpression.parse("/foo(* tar)(biz)");

      expect(
        PathExpression.match(new Directive("foo", ["biz"]), expression, 0),
      ).toBe(false);
      expect(
        PathExpression.match(new Directive("foo", ["x", "tar"]), expression, 0),
      ).toBe(false);
    });

    it("matches when a single collapsed group would already match", () => {
      const expression = PathExpression.parse("/foo(biz tar)");

      expect(
        PathExpression.match(new Directive("foo", ["biz", "tar"]), expression, 0),
      ).toBe(true);
    });
  });

  describe("an `|`-alternation value node", () => {
    it("matches any one of its literal options", () => {
      const expression = PathExpression.parse("/route(GET|POST)");

      expect(
        PathExpression.match(new Directive("route", ["GET"]), expression, 0),
      ).toBe(true);
      expect(
        PathExpression.match(new Directive("route", ["POST"]), expression, 0),
      ).toBe(true);
      expect(
        PathExpression.match(new Directive("route", ["PUT"]), expression, 0),
      ).toBe(false);
    });

    it("matches any one of its pattern options", () => {
      const expression = PathExpression.parse("/route(api*|*admin)");

      expect(
        PathExpression.match(new Directive("route", ["api_users"]), expression, 0),
      ).toBe(true);
      expect(
        PathExpression.match(new Directive("route", ["site_admin"]), expression, 0),
      ).toBe(true);
      expect(
        PathExpression.match(new Directive("route", ["other"]), expression, 0),
      ).toBe(false);
    });
  });

  describe("stacked `{...}` groups (AND) and `|` alternatives inside one", () => {
    it("requires every group's descendant to be present", () => {
      const expression = PathExpression.parse("/route{/auth}{/respond}");

      const both = new Directive("route", [], [
        new Directive("auth", []),
        new Directive("respond", []),
      ]);
      const onlyAuth = new Directive("route", [], [new Directive("auth", [])]);

      expect(PathExpression.match(both, expression, 0)).toBe(true);
      expect(PathExpression.match(onlyAuth, expression, 0)).toBe(false);
    });

    it("matches a group when any one of its `|` alternatives is satisfied", () => {
      const expression = PathExpression.parse("/route{/auth(on)|/auth(strict)}");

      const on = new Directive("route", [], [new Directive("auth", ["on"])]);
      const strict = new Directive("route", [], [new Directive("auth", ["strict"])]);
      const off = new Directive("route", [], [new Directive("auth", ["off"])]);

      expect(PathExpression.match(on, expression, 0)).toBe(true);
      expect(PathExpression.match(strict, expression, 0)).toBe(true);
      expect(PathExpression.match(off, expression, 0)).toBe(false);
    });
  });

  it("only checks the node at positionSegment, independent of the other parts", () => {
    const expression = PathExpression.parse("/server/route");

    expect(
      PathExpression.match(new Directive("server", []), expression, 0),
    ).toBe(true);
    expect(
      PathExpression.match(new Directive("server", []), expression, 1),
    ).toBe(false);
    expect(
      PathExpression.match(new Directive("route", []), expression, 1),
    ).toBe(true);
  });
});
