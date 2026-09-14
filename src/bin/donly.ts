#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { lintSchema } from "../lint/lint.js";
import { renderReport, renderJSONReport } from "../lint/report.js";
import type { LintRuleDocument } from "../lint/schema.js";

const usage = `Usage: donly lint --rules <rules.json> [--output|-o default|json] <file.donly>`;

type OutputFormat = "default" | "json";

interface LintArgs {
  rulesPath: string;
  filePath: string;
  output: OutputFormat;
}

const parseOutputFormat = (value: string | undefined): OutputFormat => {
  if (value !== "default" && value !== "json") {
    throw new Error(usage);
  }
  return value;
};

const parseLintArgs = (args: string[]): LintArgs => {
  let rulesPath: string | undefined;
  let output: OutputFormat = "default";
  const positionals: string[] = [];

  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === "--rules") {
      rulesPath = args[++index];
    } else if (arg === "--output" || arg === "-o") {
      output = parseOutputFormat(args[++index]);
    } else {
      positionals.push(arg!);
    }
  }

  if (!rulesPath || positionals.length !== 1) {
    throw new Error(usage);
  }

  return { rulesPath, filePath: positionals[0]!, output };
};

const runLint = async (args: string[]): Promise<number> => {
  const { rulesPath, filePath, output } = parseLintArgs(args);

  const rules = JSON.parse(
    await readFile(rulesPath, "utf8"),
  ) as LintRuleDocument;
  const source = await readFile(filePath, "utf8");

  const issues = lintSchema(source, rules);
  const report =
    output === "json"
      ? renderJSONReport(issues, { filePath })
      : renderReport(issues, {
          filePath,
          asciiColor: process.stdout.isTTY ?? false,
        });

  console.log(report);

  const hasErrors = issues.some((issue) => issue.severity === "error");
  return hasErrors ? 1 : 0;
};

const main = async (): Promise<number> => {
  const [command, ...rest] = process.argv.slice(2);

  switch (command) {
    case "lint":
      return runLint(rest);
    default:
      console.error(usage);
      return 1;
  }
};

main()
  .then((exitCode) => {
    process.exitCode = exitCode;
  })
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
