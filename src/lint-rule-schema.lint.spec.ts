import { describe, test, expect, mock } from "bun:test";
import type { LintIssue } from "./lint";
import type { LintRuleDocument, RuleAndEntry } from "./lint-rule-schema";

/**
 * `lint()` for the object/JSON-format `LintRuleDocument` design (see
 * `docs/specs/v1/lint-rule.md` and `./lint-rule-schema.ts`) doesn't exist
 * yet — only the types do. This mock stands in for its future signature so
 * the `test.skip()`s below can be written against it now; every case here
 * mirrors one of the type-level examples in `lint-rule-schema.spec.ts`.
 */
const lint = mock((don: string, rule: LintRuleDocument): LintIssue[] => {
  throw new Error("not implemented");
});

describe("lint-rule-schema runtime (design only, not implemented)", () => {
  test.skip("accepts an argument selector constraint", () => {
    const rule = {
      "/server/port": {
        "[1]": {
          type: "number",
          message: "port debe ser un número",
        },
      },
    } satisfies LintRuleDocument;

    const validIssues = lint(
      `
server {
  port 3000
}
`,
      rule,
    );
    expect(validIssues).toHaveLength(0);

    const invalidIssues = lint(
      `
server {
  port "3000"
}
`,
      rule,
    );
    expect(invalidIssues).toHaveLength(1);
    expect(invalidIssues[0]).toMatchObject({
      message: "port debe ser un número",
      severity: "error",
    });
  });

  test.skip("accepts range checks, enum, and pattern on a constraint", () => {
    const rule = {
      "/server/port": {
        "[1]": { type: "number", gt: 1024, lte: 65535 },
      },
      "/server/strategy": {
        "[1]": { enum: ["rolling", "recreate", "blue-green"] },
      },
      "/server/route": {
        "[1]": { type: "string", pattern: "^/[a-z0-9/_-]*$" },
      },
    } satisfies LintRuleDocument;

    const validIssues = lint(
      `
server {
  port 8080
  strategy "rolling"
  route "/api/users"
}
`,
      rule,
    );
    expect(validIssues).toHaveLength(0);

    const invalidIssues = lint(
      `
server {
  port 70000
  strategy "big-bang"
  route "api_Users"
}
`,
      rule,
    );
    expect(invalidIssues).toHaveLength(3);
  });

  test.skip("accepts or/and/not combinators on a constraint", () => {
    const rule = {
      "/server/route": {
        "[2]": {
          or: [{ type: "boolean" }, { type: "number" }],
          message: "el segundo argumento debe ser boolean o number",
        },
      },
    } satisfies LintRuleDocument;

    const validIssues = lint(
      `
server {
  route "/api" 200
  route "/health" true
}
`,
      rule,
    );
    expect(validIssues).toHaveLength(0);

    const invalidIssues = lint(
      `
server {
  route "/api" "200"
}
`,
      rule,
    );
    expect(invalidIssues).toHaveLength(1);
    expect(invalidIssues[0]).toMatchObject({
      message: "el segundo argumento debe ser boolean o number",
    });
  });

  test.skip("accepts nested sub-paths with occurrence constraints", () => {
    const rule = {
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

    const validIssues = lint(
      `
server {
  port 8080
  route "/api"
}
`,
      rule,
    );
    expect(validIssues).toHaveLength(0);

    const donWithElevenRoutes =
      "server {\n" +
      "  port 8080\n" +
      Array.from({ length: 11 }, (_, i) => `  route "/api${i}"\n`).join("") +
      "}\n";
    const invalidIssues = lint(donWithElevenRoutes, rule);
    expect(invalidIssues.length).toBeGreaterThan(0);
    expect(invalidIssues[0]).toMatchObject({
      message: "un server admite a lo más 10 route",
    });
  });

  test.skip("accepts required and rule-level and", () => {
    const rule = {
      "/server/port": {
        and: [
          { required: true, message: "server debe declarar un port" },
          { "[1]": { type: "number", lte: 65535 } },
        ],
      },
    } satisfies LintRuleDocument;

    const validIssues = lint(
      `
server {
  port 3000
}
`,
      rule,
    );
    expect(validIssues).toHaveLength(0);

    const missingPortIssues = lint(
      `
server {
  route "/api"
}
`,
      rule,
    );
    expect(missingPortIssues).toHaveLength(1);
    expect(missingPortIssues[0]).toMatchObject({
      message: "server debe declarar un port",
    });

    const tooLargeIssues = lint(
      `
server {
  port 70000
}
`,
      rule,
    );
    expect(tooLargeIssues).toHaveLength(1);
  });

  test.skip("accepts a path[N] shorthand key holding a bare constraint", () => {
    const rule = {
      "/server/route[2]": {
        or: [{ type: "boolean" }, { type: "number" }],
        message: "el segundo argumento debe ser boolean o number",
      },
    } satisfies LintRuleDocument;

    const validIssues = lint(
      `
server {
  route "/api" 200
}
`,
      rule,
    );
    expect(validIssues).toHaveLength(0);

    const invalidIssues = lint(
      `
server {
  route "/api" "200"
}
`,
      rule,
    );
    expect(invalidIssues).toHaveLength(1);
  });

  test.skip("accepts a path[N] shorthand key nested inside a rule body", () => {
    const rule = {
      "/server": {
        "/route[2]": {
          type: "number",
          gte: 100,
          lte: 599,
        },
      },
    } satisfies LintRuleDocument;

    const validIssues = lint(
      `
server {
  route "/api" 200
}
`,
      rule,
    );
    expect(validIssues).toHaveLength(0);

    const invalidIssues = lint(
      `
server {
  route "/api" 999
}
`,
      rule,
    );
    expect(invalidIssues).toHaveLength(1);
  });

  test.skip("accepts severity alongside message on a constraint", () => {
    const rule = {
      "/server/strategy": {
        "[1]": {
          enum: ["rolling", "recreate", "blue-green"],
          severity: "warning",
          message: "strategy debería ser uno de: rolling, recreate, blue-green",
        },
      },
    } satisfies LintRuleDocument;

    const validIssues = lint(
      `
server {
  strategy "rolling"
}
`,
      rule,
    );
    expect(validIssues).toHaveLength(0);

    const invalidIssues = lint(
      `
server {
  strategy "big-bang"
}
`,
      rule,
    );
    expect(invalidIssues).toHaveLength(1);
    expect(invalidIssues[0]).toMatchObject({ severity: "warning" });
  });

  test.skip("accepts every DON argument type, including bigint, null, and heredoc", () => {
    const rule = {
      "/config/maxSize": {
        "[1]": { type: "bigint", gt: 0n, message: "maxSize debe ser un bigint positivo" },
      },
      "/server/deprecated": {
        "[1]": { or: [{ type: "boolean" }, { type: "null" }] },
      },
      "/server/template": {
        "[1]": { type: "heredoc", pattern: "<html" },
      },
    } satisfies LintRuleDocument;

    const validIssues = lint(
      `
config {
  maxSize 1024n
}
server {
  deprecated null
  template <<<HTML
    <html>
      <body>Hello</body>
    </html>
}
`,
      rule,
    );
    expect(validIssues).toHaveLength(0);

    const invalidIssues = lint(
      `
config {
  maxSize 0n
}
server {
  deprecated "yes"
  template <<<TXT
    no html here
}
`,
      rule,
    );
    expect(invalidIssues).toHaveLength(3);
  });

  test.skip("accepts the root selector and the wildcard sub-path", () => {
    const rule = {
      "/*": {
        max: 1,
        message: "el documento no puede tener más de una directiva en el root",
      },
    } satisfies LintRuleDocument;

    const validIssues = lint(
      `
server {
  port 3000
}
`,
      rule,
    );
    expect(validIssues).toHaveLength(0);

    const invalidIssues = lint(
      `
server {
  port 3000
}
route /health {
  respond 200 "Ok"
}
`,
      rule,
    );
    expect(invalidIssues).toHaveLength(1);
    expect(invalidIssues[0]).toMatchObject({
      message: "el documento no puede tener más de una directiva en el root",
    });
  });

  test.skip("accepts and grouping rules for unrelated paths", () => {
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

    const rule = {
      "/server-config": {
        and: andEntries,
      },
    } satisfies LintRuleDocument;

    const validIssues = lint(
      `
server {
  port 3000
}
route /users {
  respond 200 "Ok"
}
`,
      rule,
    );
    expect(validIssues).toHaveLength(0);

    const invalidIssues = lint(
      `
server {
}
route /users {
  respond 999 "Bad"
}
`,
      rule,
    );
    expect(invalidIssues).toHaveLength(2);
  });

  test.skip("makes /respond required only when /server/route exists", () => {
    const rule = {
      "/server/route": {
        "/respond": {
          min: 1,
          message: "respond es obligatorio dentro de un route",
        },
      },
    } satisfies LintRuleDocument;

    const noServerIssues = lint(
      `
port 3000
`,
      rule,
    );
    expect(noServerIssues).toHaveLength(0);

    const noRouteIssues = lint(
      `
server {
  port 3000
}
`,
      rule,
    );
    expect(noRouteIssues).toHaveLength(0);

    const validIssues = lint(
      `
server {
  route /health {
    respond 200 "Ok"
  }
}
`,
      rule,
    );
    expect(validIssues).toHaveLength(0);

    const invalidIssues = lint(
      `
server {
  route /health {
    handler "ping"
  }
}
`,
      rule,
    );
    expect(invalidIssues).toHaveLength(1);
    expect(invalidIssues[0]).toMatchObject({
      message: "respond es obligatorio dentro de un route",
    });
  });
});
