import { describe, test, expect } from "bun:test";
import { renderReport } from "./report";
import { lintSchema } from "./lint-schema";
import type { LintRuleDocument } from "./schema";
import type { LintIssue } from "./issue";

describe("renderReport", () => {
  test("renders one row per issue, with real loc-derived positions", () => {
    const rule = {
      "/server/port[1]": { type: "number" },
    } satisfies LintRuleDocument;

    const issues = lintSchema('server {\n  port "80"\n}\n', rule);

    expect(renderReport(issues, { filePath: "my-file.donly" })).toBe(
      [
        "my-file.donly",
        '  2:8  error  argument at position 1 must be of type number',
        "",
        "1 error 0 warnings 0 info",
      ].join("\n"),
    );
  });

  test("aligns columns and counts each severity", () => {
    const issues: LintIssue[] = [
      { message: "puerto debe ser un número", severity: "error" },
      { message: "nombre en minúsculas recomendado", severity: "warning" },
      { message: "considera agregar un comentario", severity: "info" },
    ];

    expect(renderReport(issues, { filePath: "My-File.donly" })).toBe(
      [
        "My-File.donly",
        "  -  error    puerto debe ser un número",
        "  -  warning  nombre en minúsculas recomendado",
        "  -  info     considera agregar un comentario",
        "",
        "1 error 1 warning 1 info",
      ].join("\n"),
    );
  });

  test("renders a clean summary when there are no issues", () => {
    expect(renderReport([], { filePath: "my-file.donly" })).toBe(
      ["my-file.donly", "", "0 errors 0 warnings 0 info"].join("\n"),
    );
  });
});
