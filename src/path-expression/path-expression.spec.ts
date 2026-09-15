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
          { type: "literal", value: "tar" },
          { type: "literal", value: "biz" },
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
          { type: "pattern" },
          { type: "pattern", prefix: "tar" },
          { type: "pattern", suffix: "biz" },
          { type: "pattern", prefix: "foo", suffix: "viz" },
          { type: "pattern", chunks: ["biz"] },
          { type: "pattern", prefix: "foo", chunks: ["tar", "viz", "liz"] },
        ],
      },
    ]);
  });

  it("parses a segment with no arguments as an empty args list", () => {
    expect(parts("/foo()")).toEqual([
      { segment: { type: "literal", value: "foo" }, args: [] },
    ]);
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
              { type: "literal", value: "tar" },
              { type: "literal", value: "biz" },
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
 */
describe("PathExpression.match", () => {
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
