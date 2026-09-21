import { describe, test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseLintRulesDonly } from "../../lint/rules-dsl.js";
import { lintSchema } from "../../lint/lint.js";

const dir = new URL(".", import.meta.url).pathname;
const read = (name: string) => readFileSync(join(dir, name), "utf8");

describe("donly/schemas/openapi rules.donly", () => {
  const rules = parseLintRulesDonly(read("rules.donly"));

  test("accepts the full demo file", () => {
    const issues = lintSchema(read("examples/demo-file-openapi.donly"), rules);
    expect(issues).toEqual([]);
  });

  test("accepts a minimal, mostly-empty API file", () => {
    const issues = lintSchema(read("examples/minimal-api.donly"), rules);
    expect(issues).toEqual([]);
  });

  test("reports one issue per broken rule in the invalid demo file", () => {
    const issues = lintSchema(
      read("examples/demo-file-openapi.invalid.donly"),
      rules,
    );

    const messages = issues.map((issue) => issue.message).sort();
    expect(messages).toEqual(
      [
        "el documento debe declarar un openapi con la version, p. ej. openapi 3.0.3",
        "info debe declarar un version",
        "cada server debe declarar un url",
        "el primer argumento de route debe ser un método HTTP válido",
        "el segundo argumento de route debe ser un path que empiece con /",
        "cada route debe declarar al menos un response",
        "el status code de response debe estar entre 100 y 599",
      ].sort(),
    );
    expect(issues.every((issue) => issue.severity === "error")).toBe(true);
  });
});
