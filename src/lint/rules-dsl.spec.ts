import { describe, test, expect } from "bun:test";
import { parseLintRulesDonly } from "./rules-dsl";
import { lintSchema } from "./lint-schema";
import type { LintRuleDocument } from "./schema";

describe("parseLintRulesDonly", () => {
  test("or between two required sub-paths", () => {
    const source = `
or {
  /server/port { required }
  /server/socket { required }
}
`;
    expect(parseLintRulesDonly(source)).toEqual({
      or: [
        { "/server/port": { required: true } },
        { "/server/socket": { required: true } },
      ],
    } satisfies LintRuleDocument);
  });

  test("nested sub-path with a message shorthand and min", () => {
    const source = `
/server/route {
  /respond "respond es obligatorio dentro de un route" {
    min 1
  }
}
`;
    expect(parseLintRulesDonly(source)).toEqual({
      "/server/route": {
        "/respond": {
          min: 1,
          message: "respond es obligatorio dentro de un route",
        },
      },
    } satisfies LintRuleDocument);
  });

  test("argument selector with a type constraint", () => {
    const source = `
/server/port {
  [1] {
    type "number"
    message "port debe ser un número"
  }
}
`;
    expect(parseLintRulesDonly(source)).toEqual({
      "/server/port": {
        "[1]": { type: "number", message: "port debe ser un número" },
      },
    } satisfies LintRuleDocument);
  });

  test("fused path[N] shorthand", () => {
    const source = `
/server/route[2] {
  type "boolean"
}
`;
    expect(parseLintRulesDonly(source)).toEqual({
      "/server/route[2]": { type: "boolean" },
    } satisfies LintRuleDocument);
  });

  test("or with a compound alternative grouped under an anonymous `/` label", () => {
    const source = `
/server/port {
  [1] {
    or {
      # range
      / {
        type "number"
        gt 1024
        lte 65535
      }
      # auto
      / {
        type "string"
        enum "auto"
      }
    }
    message 'port debe ser un número entre 1024 y 65535, o "auto"'
  }
}
`;
    expect(parseLintRulesDonly(source)).toEqual({
      "/server/port": {
        "[1]": {
          or: [
            { type: "number", gt: 1024, lte: 65535 },
            { type: "string", enum: ["auto"] },
          ],
          message: 'port debe ser un número entre 1024 y 65535, o "auto"',
        },
      },
    } satisfies LintRuleDocument);
  });

  test("fused path[N] shorthand with a compound or alternative", () => {
    const source = `
/server/port[1] {
  or {
    # range
    / {
      type "number"
      gt 1024
      lte 65535
    }
    # auto
    / {
      type "string"
      enum "auto"
    }
  }
  message 'port debe ser un número entre 1024 y 65535, o "auto"'
}
`;
    expect(parseLintRulesDonly(source)).toEqual({
      "/server/port[1]": {
        or: [
          { type: "number", gt: 1024, lte: 65535 },
          { type: "string", enum: ["auto"] },
        ],
        message: 'port debe ser un número entre 1024 y 65535, o "auto"',
      },
    } satisfies LintRuleDocument);
  });

  test("and grouping rules for unrelated paths", () => {
    const source = `
and {
  /server/port "server debe declarar un port" { required }
  /route/respond {
    [1] {
      type "number"
      gte 100
      lte 599
      message "el status code de respond debe estar entre 100 y 599"
    }
  }
}
`;
    expect(parseLintRulesDonly(source)).toEqual({
      and: [
        {
          "/server/port": {
            required: true,
            message: "server debe declarar un port",
          },
        },
        {
          "/route/respond": {
            "[1]": {
              type: "number",
              gte: 100,
              lte: 599,
              message: "el status code de respond debe estar entre 100 y 599",
            },
          },
        },
      ],
    } satisfies LintRuleDocument);
  });

  test("wildcard sub-path must be quoted (/* collides with block comments)", () => {
    const source = `
"/*" {
  max 1
  message "el documento no puede tener más de una directiva en el root"
}
`;
    expect(parseLintRulesDonly(source)).toEqual({
      "/*": {
        max: 1,
        message: "el documento no puede tener más de una directiva en el root",
      },
    } satisfies LintRuleDocument);
  });

  test("and grouping rules for unrelated paths lints a document the same as the equivalent JSON rules", () => {
    const rulesSource = `
and {
  /server/port "server debe declarar un port" { required }
  /route/respond {
    [1] {
      type "number"
      gte 100
      lte 599
      message "el status code de respond debe estar entre 100 y 599"
    }
  }
}
`;
    const rules = parseLintRulesDonly(rulesSource);

    const valid = lintSchema(
      `
server {
  port 3000
}
route /users {
  respond 200 "Ok"
}
`,
      rules,
    );
    expect(valid).toHaveLength(0);

    const invalid = lintSchema(
      `
server {
}
route /users {
  respond 999 "Bad"
}
`,
      rules,
    );
    expect(invalid).toHaveLength(2);
    expect(invalid).toContainEqual(
      expect.objectContaining({
        message: "server debe declarar un port",
        severity: "error",
      }),
    );
    expect(invalid).toContainEqual(
      expect.objectContaining({
        message: "el status code de respond debe estar entre 100 y 599",
        severity: "error",
      }),
    );
  });

  test("parsed rules lint a document the same as the equivalent JSON rules", () => {
    const rulesSource = `
or {
  /server/port { required }
  /server/socket { required }
}
`;
    const rules = parseLintRulesDonly(rulesSource);

    const valid = lintSchema(
      `
server {
  socket "/tmp/app.sock"
}
`,
      rules,
    );
    expect(valid).toHaveLength(0);

    const invalid = lintSchema(
      `
server {
  timeout 30
}
`,
      rules,
    );
    expect(invalid).toHaveLength(1);
  });
});
