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

  test("accepts and grouping rules for unrelated paths at the document root, with no wrapping label", () => {
    const rule: LintRuleDocument = JSON.parse(`
{
  "and": [
    {
      "/server/port": {
        "required": true,
        "message": "server debe declarar un port"
      }
    },
    {
      "/route/respond": {
        "[1]": {
          "type": "number",
          "gte": 100,
          "lte": 599,
          "message": "el status code de respond debe estar entre 100 y 599"
        }
      }
    }
  ]
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

  test("requires every /server/route targeting /user to declare authorized", () => {
    const rule = {
      "/server/route(* /user)": {
        "/authorized": {
          min: 1,
          message: "todo route de /user debe declarar authorized",
        },
      },
    } satisfies LintRuleDocument;

    const issues = lintSchema(
      `
server {
    port 3000

    route GET /user {
        proxy_pass http://localhost:4000
    }
    route PUT /user {
        authorized
        proxy_pass http://localhost:4000
    }
    route POST /user {
        proxy_pass http://localhost:4000
    }
}
`,
      rule,
    );

    // `route GET /user` and `route POST /user` are missing `authorized` —
    // `route PUT /user` already declares it, so it reports no issue of its own.
    expect(issues).toHaveLength(2);
    expect(
      issues.every(
        (issue) =>
          issue.message === "todo route de /user debe declarar authorized",
      ),
    ).toBe(true);
  });

  test("requires ssl on a server that has any route targeting /user", () => {
    const rule = {
      "/server{/route(* /user)}": {
        "/ssl": {
          min: 1,
          message: "server con route de /user debe declarar ssl",
        },
      },
    } satisfies LintRuleDocument;

    const missingSslIssues = lintSchema(
      `
server {
    port 3000

    route GET /user {
        proxy_pass http://localhost:4000
    }
}
`,
      rule,
    );
    expect(missingSslIssues).toHaveLength(1);
    expect(missingSslIssues[0]).toMatchObject({
      message: "server con route de /user debe declarar ssl",
    });

    const withSslIssues = lintSchema(
      `
server {
    port 3000
    ssl on

    route GET /user {
        proxy_pass http://localhost:4000
    }
}
`,
      rule,
    );
    expect(withSslIssues).toHaveLength(0);

    // No `route` targets `/user` at all, so `{/route(* /user)}` doesn't
    // match this `server` — the `/ssl` requirement never even applies.
    const noUserRouteIssues = lintSchema(
      `
server {
    port 3000

    route GET /health {
        proxy_pass http://localhost:4000
    }
}
`,
      rule,
    );
    expect(noUserRouteIssues).toHaveLength(0);
  });

  test("a mutating route (POST|PUT|DELETE|PATCH) requires both server ssl and its own authorized", () => {
    const rule = {
      "/server/route[1]": {
        enum: ["GET", "POST", "PUT", "DELETE", "PATCH"],
        message:
          "el método de route debe ser uno de: GET, POST, PUT, DELETE, PATCH",
      },
      "/server{/route(POST|PUT|DELETE|PATCH *)}": {
        "/ssl": {
          min: 1,
          message: "server con route POST|PUT|DELETE|PATCH debe declarar ssl",
        },
      },
      "/server/route(POST|PUT|DELETE|PATCH *)": {
        "/authorized": {
          min: 1,
          message: "route POST|PUT|DELETE|PATCH debe declarar authorized",
        },
      },
    } satisfies LintRuleDocument;

    const invalidIssues = lintSchema(
      `
server {
    port 3000

    route GET /user {
        proxy_pass http://localhost:4000
    }
    route POST /user {
        authorized
        proxy_pass http://localhost:4000
    }
    route PUT /user {
        proxy_pass http://localhost:4000
    }
}
`,
      rule,
    );

    // no \`ssl\` on the server (only one issue, not one per mutating route),
    // and \`route PUT /user\` is missing \`authorized\` — \`route POST /user\`
    // already has it, and \`route GET /user\` isn't mutating at all.
    expect(invalidIssues).toHaveLength(2);
    expect(invalidIssues.map((issue) => issue.message)).toEqual([
      "server con route POST|PUT|DELETE|PATCH debe declarar ssl",
      "route POST|PUT|DELETE|PATCH debe declarar authorized",
    ]);

    const validIssues = lintSchema(
      `
server {
    port 3000
    ssl on

    route GET /user {
        proxy_pass http://localhost:4000
    }
    route POST /user {
        authorized
        proxy_pass http://localhost:4000
    }
    route PUT /user {
        authorized
        proxy_pass http://localhost:4000
    }
    route DELETE /user {
        authorized
        proxy_pass http://localhost:4000
    }
    route PATCH /user {
        authorized
        proxy_pass http://localhost:4000
    }
}
`,
      rule,
    );
    expect(validIssues).toHaveLength(0);

    // Only GET/HEAD-style routes — neither requirement even applies.
    const noMutatingRouteIssues = lintSchema(
      `
server {
    port 3000

    route GET /user {
        proxy_pass http://localhost:4000
    }
}
`,
      rule,
    );
    expect(noMutatingRouteIssues).toHaveLength(0);

    // A method outside the enum, e.g. `OPTIONS`, is flagged even though
    // it isn't one of the mutating methods the other two rules care about.
    const invalidMethodIssues = lintSchema(
      `
server {
    port 3000
    ssl on

    route OPTIONS /user {
        proxy_pass http://localhost:4000
    }
}
`,
      rule,
    );
    expect(invalidMethodIssues).toHaveLength(1);
    expect(invalidMethodIssues[0]).toMatchObject({
      message:
        "el método de route debe ser uno de: GET, POST, PUT, DELETE, PATCH",
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

  test("matches a sub-path with an exact argument group selector, e.g. /server/route(GET)", () => {
    const rule = {
      "/server/route(GET)": {
        "/respond": {
          required: true,
          message: "route GET debe declarar un respond",
        },
      },
    } satisfies LintRuleDocument;

    const validIssues = lintSchema(
      `
server {
  route GET {
    respond 200 "Ok"
  }
}
`,
      rule,
    );
    expect(validIssues).toHaveLength(0);

    const missingRespondIssues = lintSchema(
      `
server {
  route GET {
    handler "ping"
  }
}
`,
      rule,
    );
    expect(missingRespondIssues).toHaveLength(1);
    expect(missingRespondIssues[0]).toMatchObject({
      message: "route GET debe declarar un respond",
    });

    // `route POST` never matches `/server/route(GET)` — its own missing
    // `respond` is irrelevant to this rule.
    const otherMethodIssues = lintSchema(
      `
server {
  route POST {
    handler "ping"
  }
}
`,
      rule,
    );
    expect(otherMethodIssues).toHaveLength(0);
  });

  test("matches a sub-path with a wildcard/pattern argument group selector, e.g. /server/route(* text-*)", () => {
    const rule = {
      "/server/route(* text-*)": {
        "/respond": {
          required: true,
          message: "un route de tipo text-* debe declarar un respond",
        },
      },
    } satisfies LintRuleDocument;

    const validIssues = lintSchema(
      `
server {
  route GET text-plain {
    respond 200 "Ok"
  }
}
`,
      rule,
    );
    expect(validIssues).toHaveLength(0);

    const missingRespondIssues = lintSchema(
      `
server {
  route GET text-html {
    handler "ping"
  }
}
`,
      rule,
    );
    expect(missingRespondIssues).toHaveLength(1);
    expect(missingRespondIssues[0]).toMatchObject({
      message: "un route de tipo text-* debe declarar un respond",
    });

    // The second argument doesn't start with "text-", so the selector
    // itself doesn't match — the missing `respond` is irrelevant here.
    const otherContentTypeIssues = lintSchema(
      `
server {
  route GET json-plain {
    handler "ping"
  }
}
`,
      rule,
    );
    expect(otherContentTypeIssues).toHaveLength(0);
  });

  test("fuses a pattern argument-group selector with a nested argument selector, e.g. /server(us-central-*)/port[1]", () => {
    const rule = {
      "/server(us-central-*)/port[1]": {
        type: "number",
        message: "el port de un server us-central-* debe ser un número",
      },
    } satisfies LintRuleDocument;

    const validIssues = lintSchema(
      `
server "us-central-1" {
  port 8080
}
`,
      rule,
    );
    expect(validIssues).toHaveLength(0);

    const invalidIssues = lintSchema(
      `
server "us-central-1" {
  port "8080"
}
`,
      rule,
    );
    expect(invalidIssues).toHaveLength(1);
    expect(invalidIssues[0]).toMatchObject({
      message: "el port de un server us-central-* debe ser un número",
    });

    // `server` here has no argument at all, so it never matches the
    // `(us-central-*)` argument group — the constraint isn't evaluated,
    // even though its own `port` is the wrong type.
    const noArgumentIssues = lintSchema(
      `
server {
  port "8080"
}
`,
      rule,
    );
    expect(noArgumentIssues).toHaveLength(0);

    // A `server` whose argument doesn't start with "us-central-" doesn't
    // match either, regardless of its `port`'s type.
    const otherRegionIssues = lintSchema(
      `
server "eu-west-1" {
  port "8080"
}
`,
      rule,
    );
    expect(otherRegionIssues).toHaveLength(0);
  });
});

describe("known issues (bug regression, not yet fixed)", () => {
  // `defaultConstraintMessage` (lint-schema.ts) picks its message purely
  // from whether `constraint.type` is set, not from *which* check inside
  // `matchesConstraint` actually failed. So any typed constraint that
  // fails on `gte`/`gt`/`lte`/`lt`, `pattern`, or `enum` — with the value
  // matching `type` just fine — is reported as a type mismatch, which is
  // false and misleads whoever reads the report.
  test.failing("range failure is reported as its own reason, not as a type mismatch", () => {
    const rule = {
      "/server/port": {
        "[1]": { type: "number", gte: 9000 },
      },
    } satisfies LintRuleDocument;

    // 8080 *is* a number — it only fails the `gte: 9000` range check.
    const issues = lintSchema(
      `
server {
  port 8080
}
`,
      rule,
    );

    expect(issues).toHaveLength(1);
    // Actual message today: "argument at position 1 must be of type number",
    // even though the argument's type is exactly right.
    expect(issues[0]!.message).not.toMatch(/must be of type/);
  });

  test.failing("pattern failure is reported as its own reason, not as a type mismatch", () => {
    const rule = {
      "/server/route": {
        "[1]": { type: "string", pattern: "^/[a-z]+$" },
      },
    } satisfies LintRuleDocument;

    // "/API" is a string — it only fails the `pattern` check.
    const issues = lintSchema(
      `
server {
  route "/API"
}
`,
      rule,
    );

    expect(issues).toHaveLength(1);
    expect(issues[0]!.message).not.toMatch(/must be of type/);
  });

  test.failing("enum failure is reported as its own reason, not as a type mismatch", () => {
    const rule = {
      "/server/strategy": {
        "[1]": { type: "string", enum: ["rolling", "recreate"] },
      },
    } satisfies LintRuleDocument;

    // "big-bang" is a string — it only fails the `enum` check.
    const issues = lintSchema(
      `
server {
  strategy "big-bang"
}
`,
      rule,
    );

    expect(issues).toHaveLength(1);
    expect(issues[0]!.message).not.toMatch(/must be of type/);
  });

  // `Part.scan` (`../v1/compiler/part.ts`) tracks `column` by adding each
  // token's *byte* length (`Span.length`, measured on the raw `u8` buffer)
  // to a running counter, never decoding UTF-8. A multi-byte character
  // earlier on the same line (e.g. "é", 2 bytes) therefore inflates every
  // later column on that line by its extra byte count, so the reported
  // column no longer matches the character position any editor — or a
  // human counting characters — would show for that same source line.
  test.failing("reported column matches the character position, not the UTF-8 byte offset", () => {
    const rule = {
      "/titulo": { "[2]": { type: "string" } },
    } satisfies LintRuleDocument;

    // Characters (0-based): t-i-t-u-l-o(6) space(6) "café"(7..12) space(13) 42(14)
    // so "42" starts at character column 14 (15 in the report's 1-based columns).
    const don = `titulo "café" 42`;
    const issues = lintSchema(don, rule);

    expect(issues).toHaveLength(1);
    const column = issues[0]!.loc!.start.span.startLocation.column + 1;
    // Actual today: 16 — one column too far right, because "é" costs 2
    // bytes but is only 1 character.
    expect(column).toBe(15);
  });

  // Same byte-vs-character drift as above, but with an astral emoji
  // ("🎉", U+1F389): 1 character, 2 UTF-16 code units, 4 UTF-8 bytes. The
  // byte-counting tokenizer also tokenizes it as four separate 1-byte
  // "unknown" parts (it isn't in any charset whitelist), each still
  // advancing `column` by 1 — so the drift compounds with every non-ASCII
  // character on the line instead of staying a flat off-by-one.
  test.failing("an emoji earlier on the line doesn't multiply the column drift", () => {
    const rule = {
      "/titulo": { "[2]": { type: "string" } },
    } satisfies LintRuleDocument;

    // Characters (0-based): t-i-t-u-l-o(6) space(6) "🎉fiesta"(7..16) space(17) 42(18)
    // so "42" starts at character column 18 (in the report's 1-based columns).
    const don = `titulo "🎉fiesta" 42`;
    const issues = lintSchema(don, rule);

    expect(issues).toHaveLength(1);
    const column = issues[0]!.loc!.start.span.startLocation.column + 1;
    // Actual today: 21 — three columns too far right, three extra bytes
    // ("🎉" costs 4 bytes for its single character) instead of zero.
    expect(column).toBe(18);
  });

  // The emoji/multi-byte drift is confined to the line it appears on: once
  // `Part.scan` sees the newline byte it resets `column` to 0 and bumps
  // `line`, so an ASCII-only line after a non-ASCII one still gets the
  // right, unaffected `line`/`column` — this is not part of the bug above.
  test("row/line numbers stay correct on later lines despite emoji or accented text earlier in the document", () => {
    const rule = {
      "/titulo": { "[2]": { type: "string" } },
      "/segunda": { "[2]": { type: "string" } },
      "/tercera": { "[2]": { type: "string" } },
    } satisfies LintRuleDocument;

    const don = `titulo "🎉🎉🎉" 1\nsegunda "ok" 2\ntercera "😀" 3`;
    const issues = lintSchema(don, rule);

    expect(issues).toHaveLength(3);
    expect(issues.map((issue) => issue.loc!.start.span.startLocation.line)).toEqual([
      0, 1, 2,
    ]);
    // "segunda" is a plain-ASCII line, so its column is unaffected by the
    // emoji-heavy line above it: "segunda " (8) + "\"ok\"" (4) + " " (1) = 13.
    expect(issues[1]!.loc!.start.span.startLocation.column).toBe(13);
  });
});
