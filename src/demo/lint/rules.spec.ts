import { describe, test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseLintRulesDonly } from "../../lint/rules-dsl.js";
import { lintSchema } from "../../lint/lint.js";

const dir = new URL(".", import.meta.url).pathname;
const read = (name: string) => readFileSync(join(dir, name), "utf8");

describe("donly/demo/lint rules.donly", () => {
  const rules = parseLintRulesDonly(read("rules.donly"));

  test("accepts a fully valid document", () => {
    const issues = lintSchema(read("example-valid.donly"), rules);
    expect(issues).toEqual([]);
  });

  test("reports one issue per broken rule in the invalid document", () => {
    const issues = lintSchema(read("example-invalid.donly"), rules);

    const messages = issues.map((issue) => issue.message).sort();
    expect(messages).toEqual(
      [
        "config debe declarar un maxSize",
        "deprecated debe ser true, false, o null",
        "el path de route es inválido: debe ser un string, empezar con / y no repetir //",
        "port debe ser un número entre 1 y 65535",
        "respond no puede responder 404 directamente; usa un route catch-all",
        "strategy debería ser uno de: rolling, recreate, blue-green",
      ].sort(),
    );

    expect(issues.filter((issue) => issue.severity === "error")).toHaveLength(5);
    expect(issues.filter((issue) => issue.severity === "warning")).toHaveLength(1);
    expect(
      issues.find((issue) => issue.message.includes("strategy"))?.severity,
    ).toBe("warning");
  });
});
