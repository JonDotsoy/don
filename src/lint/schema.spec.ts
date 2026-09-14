import { describe, it, expectTypeOf } from "bun:test";
import type {
  ArgumentConstraint,
  LintRuleDocument,
  RuleAndEntry,
  RuleBody,
} from "./schema";

describe("lint schema types", () => {
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
      and: [{ type: "string" }, { type: "string", pattern: "^/" }],
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

  it("validates both body and argument constraints at a depth of 10 sub-paths", () => {
    const example = {
      "/l1": {
        required: true,
        "/l2": {
          max: 5,
          "/l3": {
            min: 1,
            "/l4": {
              required: true,
              "/l5": {
                max: 1,
                "/l6": {
                  min: 0,
                  "/l7": {
                    required: true,
                    "/l8": {
                      max: 2,
                      "/l9": {
                        min: 1,
                        "/l10": {
                          required: true,
                          "[1]": {
                            type: "number",
                            gte: 1,
                            lte: 10,
                            message: "l10 debe declarar un número entre 1 y 10",
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    } satisfies LintRuleDocument;

    expectTypeOf(example).toMatchTypeOf<LintRuleDocument>();

    const l1 = example["/l1"];
    const l2 = l1["/l2"];
    const l3 = l2["/l3"];
    const l4 = l3["/l4"];
    const l5 = l4["/l5"];
    const l6 = l5["/l6"];
    const l7 = l6["/l7"];
    const l8 = l7["/l8"];
    const l9 = l8["/l9"];
    const l10 = l9["/l10"];

    expectTypeOf(l1).toMatchTypeOf<RuleBody>();
    expectTypeOf(l2).toMatchTypeOf<RuleBody>();
    expectTypeOf(l3).toMatchTypeOf<RuleBody>();
    expectTypeOf(l4).toMatchTypeOf<RuleBody>();
    expectTypeOf(l5).toMatchTypeOf<RuleBody>();
    expectTypeOf(l6).toMatchTypeOf<RuleBody>();
    expectTypeOf(l7).toMatchTypeOf<RuleBody>();
    expectTypeOf(l8).toMatchTypeOf<RuleBody>();
    expectTypeOf(l9).toMatchTypeOf<RuleBody>();
    expectTypeOf(l10).toMatchTypeOf<RuleBody>();
    expectTypeOf(l10["[1]"]).toMatchTypeOf<ArgumentConstraint>();
  });

  it("types /server/port's value as a RuleBody", () => {
    const example = {
      "/server/port": {
        required: true,
        "[1]": { type: "number" },
      },
    } satisfies LintRuleDocument;

    expectTypeOf(example).toMatchTypeOf<LintRuleDocument>();
    expectTypeOf(example["/server/port"]).toMatchTypeOf<RuleBody>();
  });

  it("types /server/route's sub-path and argument selector siblings correctly", () => {
    const example = {
      "/server/route": {
        "/body": {
          required: true,
          message: "route debe declarar un body",
        },
        "[1]": {
          type: "string",
          pattern: "^/",
        },
      },
    } satisfies LintRuleDocument;

    expectTypeOf(example).toMatchTypeOf<LintRuleDocument>();
    expectTypeOf(example["/server/route"]).toMatchTypeOf<RuleBody>();
    expectTypeOf(example["/server/route"]["/body"]).toMatchTypeOf<RuleBody>();
    expectTypeOf(
      example["/server/route"]["[1]"],
    ).toMatchTypeOf<ArgumentConstraint>();
  });

  it("types /server/port[1]'s value as an ArgumentConstraint", () => {
    const example = {
      "/server/port[1]": {
        type: "number",
        message: "port debe ser un número",
      },
    } satisfies LintRuleDocument;

    expectTypeOf(example).toMatchTypeOf<LintRuleDocument>();
    expectTypeOf(example["/server/port[1]"]).toMatchTypeOf<ArgumentConstraint>();
  });

  it("accepts a path[N] shorthand key nested inside a rule body", () => {
    const example = {
      "/server": {
        "/route[2]": {
          type: "number",
          gte: 100,
          lte: 599,
        },
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
      gt: 0n,
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

  it("accepts and grouping rules for unrelated paths", () => {
    const andEntries: RuleAndEntry[] = [
      {
        "/server": {
          "/port": {
            required: true,
            message: "server debe declarar un port",
          },
        },
      },
      {
        "/route": {
          "/respond": {
            "[1]": { type: "number", gte: 100, lte: 599 },
          },
        },
      },
    ];

    const example = {
      "/server-config": {
        and: andEntries,
      },
    } satisfies LintRuleDocument;

    expectTypeOf(example).toMatchTypeOf<LintRuleDocument>();
  });

  it("makes /respond required only when /server/route exists", () => {
    // "/server/route" carries no `required`/`min`, so it's optional — but
    // once it *does* match, its own "/respond" min:1 kicks in, per
    // RuleBody's semantics ("min... requires occurrences of a child once
    // its parent has already matched"). No new property is needed: this
    // conditional-on-existence requirement already falls out of nesting
    // min under the sub-path whose presence should trigger it.
    const example = {
      "/server/route": {
        "/respond": {
          min: 1,
          message: "respond es obligatorio dentro de un route",
        },
      },
    } satisfies LintRuleDocument;

    expectTypeOf(example).toMatchTypeOf<LintRuleDocument>();
  });

  it("accepts or/and/not directly at the document root", () => {
    const orDocuments: LintRuleDocument[] = [
      { "/server/port": { required: true } },
      { "/server/socket": { required: true } },
    ];
    const orExample = { or: orDocuments } satisfies LintRuleDocument;
    expectTypeOf(orExample).toMatchTypeOf<LintRuleDocument>();

    const andDocuments: LintRuleDocument[] = [
      { "/server/port": { required: true } },
      { "/server": { "/route": { max: 10 } } },
    ];
    const andExample = { and: andDocuments } satisfies LintRuleDocument;
    expectTypeOf(andExample).toMatchTypeOf<LintRuleDocument>();

    const notExample = {
      not: { "/server/legacy-mode": { required: true } },
    } satisfies LintRuleDocument;
    expectTypeOf(notExample).toMatchTypeOf<LintRuleDocument>();
  });
});
