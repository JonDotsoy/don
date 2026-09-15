import { describe, it, expect } from "bun:test";
import { PathExpression, type PathNode } from "./path-expression";

const parts = (path: string): PathNode[] => PathExpression.parse(path).parts;

describe("PathExpression.parse", () => {
  it("parses the empty root path", () => {
    expect(parts("/")).toEqual([]);
  });

  it("parses a static literal segment", () => {
    expect(parts("/foo")).toEqual([{ type: "literal", value: "foo" }]);
  });

  it("parses a full single-segment wildcard as an empty pattern", () => {
    expect(parts("/*")).toEqual([{ type: "pattern" }]);
  });

  it("parses a prefix pattern", () => {
    expect(parts("/foo*")).toEqual([{ type: "pattern", prefix: "foo" }]);
  });

  it("parses a suffix pattern", () => {
    expect(parts("/*bar")).toEqual([{ type: "pattern", suffix: "bar" }]);
  });

  it("parses a prefix+suffix pattern", () => {
    expect(parts("/foo*biz")).toEqual([
      { type: "pattern", prefix: "foo", suffix: "biz" },
    ]);
  });

  it("parses multiple intermediate wildcards as chunks", () => {
    expect(parts("/foo*biz*tar")).toEqual([
      { type: "pattern", prefix: "foo", chunks: ["biz"], suffix: "tar" },
    ]);
  });

  it("unescapes a `\\/` so it's read as a literal `/` instead of a separator", () => {
    expect(parts("/\\/tar")).toEqual([{ type: "literal", value: "/tar" }]);
  });

  it("parses a segment with literal arguments", () => {
    expect(parts("/foo(tar biz)")).toEqual([
      {
        type: "args",
        segment: "foo",
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
        type: "args",
        segment: "foo",
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
      { type: "args", segment: "foo", args: [] },
    ]);
  });

  it("parses a multi-segment path combined with a wildcard", () => {
    expect(parts("/foo/*/tar")).toEqual([
      { type: "literal", value: "foo" },
      { type: "pattern" },
      { type: "literal", value: "tar" },
    ]);
  });

  it("parses a multi-segment path combined with a pattern", () => {
    expect(parts("/foo*biz/lol")).toEqual([
      { type: "pattern", prefix: "foo", suffix: "biz" },
      { type: "literal", value: "lol" },
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
});
