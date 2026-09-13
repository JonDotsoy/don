import { describe, it, expectTypeOf } from "bun:test";
import type { ArgumentConstraint, LintRuleDocument } from "./lint-rule-schema";

describe("lint-rule-schema types", () => {
  it("accepts an argument selector constraint", () => {
    const example = {
      "/server/port": {
        "[1]": {
          type: "number",
          message: "port debe ser un número",
        },
      },
    } satisfies LintRuleDocument;

    expectTypeOf(example).toMatchTypeOf<LintRuleDocument>();
  });

  it("accepts range checks, enum, and pattern on a constraint", () => {
    const range = {
      type: "number",
      gt: 1024,
      lte: 65535,
    } satisfies ArgumentConstraint;
    expectTypeOf(range).toMatchTypeOf<ArgumentConstraint>();

    const choice = {
      enum: ["rolling", "recreate", "blue-green"],
    } satisfies ArgumentConstraint;
    expectTypeOf(choice).toMatchTypeOf<ArgumentConstraint>();

    const regex = {
      type: "string",
      pattern: "^/[a-z0-9/_-]*$",
    } satisfies ArgumentConstraint;
    expectTypeOf(regex).toMatchTypeOf<ArgumentConstraint>();
  });

  it("accepts or/and/not combinators on a constraint", () => {
    const union = {
      or: [{ type: "boolean" }, { type: "number" }],
    } satisfies ArgumentConstraint;
    expectTypeOf(union).toMatchTypeOf<ArgumentConstraint>();

    const intersection = {
      and: [{ type: "string" }, { pattern: "^/" }],
    } satisfies ArgumentConstraint;
    expectTypeOf(intersection).toMatchTypeOf<ArgumentConstraint>();

    const negation = {
      not: { enum: ["big-bang"] },
    } satisfies ArgumentConstraint;
    expectTypeOf(negation).toMatchTypeOf<ArgumentConstraint>();
  });

  it("accepts nested sub-paths with occurrence constraints", () => {
    const example = {
      "/server": {
        "/route": {
          max: 10,
          message: "un server admite a lo más 10 route",
        },
        "/port": {
          "[1]": { type: "number", gt: 1024, lte: 65535 },
        },
      },
    } satisfies LintRuleDocument;

    expectTypeOf(example).toMatchTypeOf<LintRuleDocument>();
  });

  it("accepts required and rule-level and", () => {
    const example = {
      "/server/port": {
        and: [
          { required: true, message: "server debe declarar un port" },
          { "[1]": { type: "number", lte: 65535 } },
        ],
      },
    } satisfies LintRuleDocument;

    expectTypeOf(example).toMatchTypeOf<LintRuleDocument>();
  });

  it("accepts a path[N] shorthand key holding a bare constraint", () => {
    const example = {
      "/server/route[2]": {
        or: [{ type: "boolean" }, { type: "number" }],
        message: "el segundo argumento debe ser boolean o number",
      },
    } satisfies LintRuleDocument;

    expectTypeOf(example).toMatchTypeOf<LintRuleDocument>();
  });

  it("accepts severity alongside message on a constraint", () => {
    const example = {
      "/server/strategy": {
        "[1]": {
          enum: ["rolling", "recreate", "blue-green"],
          severity: "warning",
          message: "strategy debería ser uno de: rolling, recreate, blue-green",
        },
      },
    } satisfies LintRuleDocument;

    expectTypeOf(example).toMatchTypeOf<LintRuleDocument>();
  });

  it("accepts every DON argument type, including bigint, null, and heredoc", () => {
    const bigintRange = {
      type: "bigint",
      gt: 0,
      message: "maxSize debe ser un bigint positivo",
    } satisfies ArgumentConstraint;
    expectTypeOf(bigintRange).toMatchTypeOf<ArgumentConstraint>();

    const booleanOrNull = {
      or: [{ type: "boolean" }, { type: "null" }],
    } satisfies ArgumentConstraint;
    expectTypeOf(booleanOrNull).toMatchTypeOf<ArgumentConstraint>();

    const heredoc = {
      type: "heredoc",
      pattern: "<html",
    } satisfies ArgumentConstraint;
    expectTypeOf(heredoc).toMatchTypeOf<ArgumentConstraint>();
  });

  it("accepts the root selector and the wildcard sub-path", () => {
    const example = {
      "/*": {
        max: 1,
        message: "el documento no puede tener más de una directiva en el root",
      },
    } satisfies LintRuleDocument;

    expectTypeOf(example).toMatchTypeOf<LintRuleDocument>();
  });

  it("accepts and grouping rules for unrelated paths, with an explicit path", () => {
    const example = {
      "/server-config": {
        and: [
          {
            path: "/server/port",
            required: true,
            message: "server debe declarar un port",
          },
          {
            path: "/route/respond",
            "[1]": { type: "number", gte: 100, lte: 599 },
          },
        ],
      },
    } satisfies LintRuleDocument;

    expectTypeOf(example).toMatchTypeOf<LintRuleDocument>();
  });
});
