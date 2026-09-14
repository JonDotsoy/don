import { describe, test, expect } from "bun:test";
import { lintSchema } from "./lint-schema";
import { renderReport } from "./report";
import type { LintRuleDocument, RuleAndEntry } from "./schema";
import type { Directive } from "../don";
import type { LintIssue } from "./types";

describe("lint schema runtime", () => {
  test("accepts an argument selector constraint", () => {
    const rule = {
      "/server/port": {
        "[1]": {
          type: "number",
          message: "port debe ser un número",
        },
      },
    } satisfies LintRuleDocument;

    const validIssues = lintSchema(
      `
server {
  port 3000
}
`,
      rule,
    );
    expect(validIssues).toHaveLength(0);

    const invalidIssues = lintSchema(
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
    // Snapshotted through a JSON round-trip: `Token`/`Part` carry a
    // process-global `id` counter that a raw-object snapshot would print
    // and that shifts with unrelated parses elsewhere in the test run,
    // but `toJSON()` (invoked by `JSON.stringify`) omits it.
    expect(JSON.parse(JSON.stringify(invalidIssues))).toMatchSnapshot();
  });

  test("accepts range checks, enum, and pattern on a constraint", () => {
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

    const validIssues = lintSchema(
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

    const invalidIssues = lintSchema(
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

  test("accepts an or combinator on a constraint", () => {
    const rule = {
      "/server/port": {
        "[1]": {
          or: [
            { type: "number", gt: 1024, lte: 65535 },
            { type: "string", enum: ["auto"] },
          ],
          message: 'port debe ser un número entre 1024 y 65535, o "auto"',
        },
      },
    } satisfies LintRuleDocument;

    const validNumberIssues = lintSchema(
      `
server {
  port 8080
}
`,
      rule,
    );
    expect(validNumberIssues).toHaveLength(0);

    const validAutoIssues = lintSchema(
      `
server {
  port "auto"
}
`,
      rule,
    );
    expect(validAutoIssues).toHaveLength(0);

    const invalidIssues = lintSchema(
      `
server {
  port "not-auto"
}
`,
      rule,
    );
    expect(invalidIssues).toHaveLength(1);
    expect(invalidIssues[0]).toMatchObject({
      message: 'port debe ser un número entre 1024 y 65535, o "auto"',
    });
  });

  test("accepts an and combinator on a constraint", () => {
    const rule = {
      "/server/route": {
        "[1]": {
          and: [
            { type: "string" },
            { type: "string", pattern: "^/", message: "el path debe empezar con /" },
            {
              type: "string",
              pattern: "^(?!.*//).*$",
              message: "el path no puede tener // repetidos",
            },
          ],
          message: "el path de route es inválido",
        },
      },
    } satisfies LintRuleDocument;

    const validIssues = lintSchema(
      `
server {
  route "/api/users" {
    respond 200 "Ok"
  }
}
`,
      rule,
    );
    expect(validIssues).toHaveLength(0);

    const missingSlashIssues = lintSchema(
      `
server {
  route "api/users" {
    respond 200 "Ok"
  }
}
`,
      rule,
    );
    expect(missingSlashIssues).toHaveLength(1);

    const doubleSlashIssues = lintSchema(
      `
server {
  route "/api//users" {
    respond 200 "Ok"
  }
}
`,
      rule,
    );
    expect(doubleSlashIssues).toHaveLength(1);
  });

  test("accepts a not combinator on a constraint", () => {
    const rule = {
      "/server/strategy": {
        "[1]": {
          not: { enum: ["big-bang"] },
          message: 'strategy no puede ser "big-bang"',
        },
      },
    } satisfies LintRuleDocument;

    const validIssues = lintSchema(
      `
server {
  strategy "rolling"
}
`,
      rule,
    );
    expect(validIssues).toHaveLength(0);

    const invalidIssues = lintSchema(
      `
server {
  strategy "big-bang"
}
`,
      rule,
    );
    expect(invalidIssues).toHaveLength(1);
    expect(invalidIssues[0]).toMatchObject({
      message: 'strategy no puede ser "big-bang"',
    });
  });

  test("accepts nested sub-paths with occurrence constraints", () => {
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

    const validIssues = lintSchema(
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
    const invalidIssues = lintSchema(donWithElevenRoutes, rule);
    expect(invalidIssues.length).toBeGreaterThan(0);
    expect(invalidIssues[0]).toMatchObject({
      message: "un server admite a lo más 10 route",
    });
  });

  test("accepts required and rule-level and", () => {
    const rule = {
      "/server/port": {
        and: [
          { required: true, message: "server debe declarar un port" },
          { "[1]": { type: "number", lte: 65535 } },
        ],
      },
    } satisfies LintRuleDocument;

    const validIssues = lintSchema(
      `
server {
  port 3000
}
`,
      rule,
    );
    expect(validIssues).toHaveLength(0);

    const missingPortIssues = lintSchema(
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

    const tooLargeIssues = lintSchema(
      `
server {
  port 70000
}
`,
      rule,
    );
    expect(tooLargeIssues).toHaveLength(1);
  });

  test("accepts a path[N] shorthand key holding a bare constraint", () => {
    const rule = {
      "/server/route[2]": {
        or: [{ type: "boolean" }, { type: "number" }],
        message: "el segundo argumento debe ser boolean o number",
      },
    } satisfies LintRuleDocument;

    const validIssues = lintSchema(
      `
server {
  route "/api" 200
}
`,
      rule,
    );
    expect(validIssues).toHaveLength(0);

    const invalidIssues = lintSchema(
      `
server {
  route "/api" "200"
}
`,
      rule,
    );
    expect(invalidIssues).toHaveLength(1);
  });

  test("accepts a path[N] shorthand key nested inside a rule body", () => {
    const rule = {
      "/server": {
        "/route[2]": {
          type: "number",
          gte: 100,
          lte: 599,
        },
      },
    } satisfies LintRuleDocument;

    const validIssues = lintSchema(
      `
server {
  route "/api" 200
}
`,
      rule,
    );
    expect(validIssues).toHaveLength(0);

    const invalidIssues = lintSchema(
      `
server {
  route "/api" 999
}
`,
      rule,
    );
    expect(invalidIssues).toHaveLength(1);
  });

  test("accepts severity alongside message on a constraint", () => {
    const rule = {
      "/server/strategy": {
        "[1]": {
          enum: ["rolling", "recreate", "blue-green"],
          severity: "warning",
          message: "strategy debería ser uno de: rolling, recreate, blue-green",
        },
      },
    } satisfies LintRuleDocument;

    const validIssues = lintSchema(
      `
server {
  strategy "rolling"
}
`,
      rule,
    );
    expect(validIssues).toHaveLength(0);

    const invalidIssues = lintSchema(
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

  test("accepts every DON argument type, including bigint, null, and heredoc", () => {
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

    const validIssues = lintSchema(
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

    const invalidIssues = lintSchema(
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

  test("accepts the root selector and the wildcard sub-path", () => {
    const rule = {
      "/*": {
        max: 1,
        message: "el documento no puede tener más de una directiva en el root",
      },
    } satisfies LintRuleDocument;

    const validIssues = lintSchema(
      `
server {
  port 3000
}
`,
      rule,
    );
    expect(validIssues).toHaveLength(0);

    const invalidIssues = lintSchema(
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

  test("accepts and grouping rules for unrelated paths", () => {
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

    const validIssues = lintSchema(
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

    const invalidIssues = lintSchema(
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

  /* TODO: docs/lint/rules.md ("JSON example: `and` grouping rules for
   * unrelated paths") documents each rule-level `and` entry addressed by an
   * explicit `path` field, e.g. `{ "path": "/server/port", "required": true }`.
   * `lintSchema` never reads such a field — only `RuleAndEntry`s whose own
   * keys are all sub-paths (`/server/port`) are routed to the document root
   * (see `isSubPathOnlyEntry` in `./lint-schema.ts`); an entry keyed by
   * `path` instead falls through `applyValue` against the *enclosing* key's
   * (empty) matches, so only the first entry's `required` check ever fires.
   * Either `lintSchema` needs to support the documented `path` field, or the
   * doc's example needs to switch to the sub-path-keyed form the tests above
   * already cover. Skipped until that's decided. */
  test.skip("accepts and grouping rules for unrelated paths via an explicit `path` field (as documented)", () => {
    const rule: LintRuleDocument = JSON.parse(`
{
  "/server-config": {
    "and": [
      {
        "path": "/server/port",
        "required": true,
        "message": "server debe declarar un port"
      },
      {
        "path": "/route/respond",
        "[1]": {
          "type": "number",
          "gte": 100,
          "lte": 599,
          "message": "el status code de respond debe estar entre 100 y 599"
        }
      }
    ]
  }
}
`);

    const invalidIssues = lintSchema(
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

  test("makes /respond required only when /server/route exists", () => {
    const rule = {
      "/server/route": {
        "/respond": {
          min: 1,
          message: "respond es obligatorio dentro de un route",
        },
      },
    } satisfies LintRuleDocument;

    const noServerIssues = lintSchema(
      `
port 3000
`,
      rule,
    );
    expect(noServerIssues).toHaveLength(0);

    const noRouteIssues = lintSchema(
      `
server {
  port 3000
}
`,
      rule,
    );
    expect(noRouteIssues).toHaveLength(0);

    const validIssues = lintSchema(
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

    const invalidIssues = lintSchema(
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

  test("accepts an or between two alternative documents at the root", () => {
    const orDocuments: LintRuleDocument[] = [
      { "/server/port": { required: true } },
      { "/server/socket": { required: true } },
    ];

    const rule = {
      or: orDocuments,
    } satisfies LintRuleDocument;

    const validPortIssues = lintSchema(
      `
server {
  port 3000
}
`,
      rule,
    );
    expect(validPortIssues).toHaveLength(0);

    const validSocketIssues = lintSchema(
      `
server {
  socket "/tmp/app.sock"
}
`,
      rule,
    );
    expect(validSocketIssues).toHaveLength(0);

    const invalidIssues = lintSchema(
      `
server {
  timeout 30
}
`,
      rule,
    );
    expect(invalidIssues.length).toBeGreaterThan(0);
  });

  test("accepts an or combinator on port or socket, satisfied by socket alone", () => {
    const rule = {
      or: [
        { "/server/port": { required: true } },
        { "/server/socket": { required: true } },
      ],
    } satisfies LintRuleDocument;

    const validSocketIssues = lintSchema(
      `
server {
  socket "/tmp/app.sock"
}
`,
      rule,
    );
    expect(validSocketIssues).toHaveLength(0);

    expect(
      renderReport(validSocketIssues, { filePath: "server.donly" }),
    ).toMatchSnapshot();
  });

  test("accepts an or combinator on port or socket, violated when neither is present", () => {
    const rule = {
      or: [
        { "/server/port": { required: true } },
        { "/server/socket": { required: true } },
      ],
    } satisfies LintRuleDocument;

    const invalidIssues = lintSchema(
      `
server {
}
`,
      rule,
    );
    expect(invalidIssues.length).toBeGreaterThan(0);

    expect(
      renderReport(invalidIssues, { filePath: "server.donly" }),
    ).toMatchSnapshot();
  });

  test("accepts a message on the or combinator, shown when neither alternative passes", () => {
    const rule = {
      or: [
        { "/server/port": { required: true } },
        { "/server/socket": { required: true } },
      ],
      message: "server debe declarar port o socket",
    } satisfies LintRuleDocument;

    const invalidIssues = lintSchema(
      `
server {
}
`,
      rule,
    );
    expect(invalidIssues).toHaveLength(1);
    expect(invalidIssues[0]).toMatchObject({
      message: "server debe declarar port o socket",
    });

    expect(
      renderReport(invalidIssues, { filePath: "server.donly" }),
    ).toMatchSnapshot();
  });

  test("accepts a custom evaluation at the document root", () => {
    const rule = {
      *evaluation(directive: Directive): Iterable<LintIssue> {
        if (directive.children.length === 0) {
          yield {
            message: "el documento no puede estar vacío",
            severity: "error",
          };
        }
      },
    } satisfies LintRuleDocument;

    const validIssues = lintSchema("server {\n  port 3000\n}\n", rule);
    expect(validIssues).toHaveLength(0);

    const invalidIssues = lintSchema("", rule);
    expect(invalidIssues).toHaveLength(1);
    expect(invalidIssues[0]).toMatchObject({
      message: "el documento no puede estar vacío",
    });
    expect(JSON.parse(JSON.stringify(invalidIssues))).toMatchSnapshot();
  });

  test("accepts a custom evaluation on a rule body", () => {
    const rule = {
      "/server/port": {
        *evaluation(directive: Directive): Iterable<LintIssue> {
          if (
            typeof directive.args[0] === "number" &&
            directive.args[0] < 1024
          ) {
            yield { message: "port privilegiado", severity: "warning" };
          }
        },
      },
    } satisfies LintRuleDocument;

    const validIssues = lintSchema("server {\n  port 8080\n}\n", rule);
    expect(validIssues).toHaveLength(0);

    const invalidIssues = lintSchema("server {\n  port 80\n}\n", rule);
    expect(invalidIssues).toHaveLength(1);
    expect(invalidIssues[0]).toMatchObject({
      message: "port privilegiado",
      severity: "warning",
    });
    expect(JSON.parse(JSON.stringify(invalidIssues))).toMatchSnapshot();
  });

  test("accepts a custom evaluation on an argument constraint", () => {
    const rule = {
      "/server/port[1]": {
        *evaluation(argument: unknown, position: number): Iterable<LintIssue> {
          if (argument === 8080) {
            yield {
              message: `argumento ${position}: 8080 está reservado`,
              severity: "error",
            };
          }
        },
      },
    } satisfies LintRuleDocument;

    const validIssues = lintSchema("server {\n  port 3000\n}\n", rule);
    expect(validIssues).toHaveLength(0);

    const invalidIssues = lintSchema("server {\n  port 8080\n}\n", rule);
    expect(invalidIssues).toHaveLength(1);
    expect(invalidIssues[0]).toMatchObject({
      message: "argumento 1: 8080 está reservado",
    });
    expect(JSON.parse(JSON.stringify(invalidIssues))).toMatchSnapshot();
  });

  test("runs an argument constraint's evaluation alongside its declarative checks", () => {
    const rule = {
      "/server/port[1]": {
        type: "number",
        *evaluation(argument: unknown, position: number): Iterable<LintIssue> {
          if (typeof argument === "number" && argument > 65535) {
            yield {
              message: `argumento ${position}: fuera de rango`,
              severity: "error",
            };
          }
        },
      },
    } satisfies LintRuleDocument;

    const validIssues = lintSchema("server {\n  port 3000\n}\n", rule);
    expect(validIssues).toHaveLength(0);

    const wrongTypeIssues = lintSchema('server {\n  port "x"\n}\n', rule);
    expect(wrongTypeIssues).toHaveLength(1);

    const outOfRangeIssues = lintSchema("server {\n  port 70000\n}\n", rule);
    expect(outOfRangeIssues).toHaveLength(1);
    expect(outOfRangeIssues[0]).toMatchObject({
      message: "argumento 1: fuera de rango",
    });
    expect(JSON.parse(JSON.stringify(outOfRangeIssues))).toMatchSnapshot();
  });
});
