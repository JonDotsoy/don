#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { DON } from "../don.js";
import { DirectiveJSONEncoder } from "../directive-json.js";
import type { DirectiveReducer } from "../directive-json.js";
import { lintSchema } from "../lint/lint.js";
import { renderReport, renderJSONReport } from "../lint/report.js";
import type { LintRuleDocument } from "../lint/schema.js";

const topLevelUsage = `Usage: donly <command> [options]

Commands:
  lint --rules <rules.json> [--output|-o default|json] <file.donly>
  inspect [--strategy|-s nested|tuple|raw] <file.donly>`;

const lintUsage = `Usage: donly lint --rules <rules.json> [--output|-o default|json] <file.donly>`;

type OutputFormat = "default" | "json";

interface LintArgs {
  rulesPath: string;
  filePath: string;
  output: OutputFormat;
}

const parseOutputFormat = (value: string | undefined): OutputFormat => {
  if (value !== "default" && value !== "json") {
    throw new Error(lintUsage);
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
    throw new Error(lintUsage);
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

const inspectUsage = `Usage: donly inspect [--strategy|-s nested|tuple|raw] <file.donly>`;

type InspectStrategy = "nested" | "tuple" | "raw";

interface InspectArgs {
  filePath: string;
  strategy: InspectStrategy;
}

const parseInspectStrategy = (value: string | undefined): InspectStrategy => {
  if (value !== "nested" && value !== "tuple" && value !== "raw") {
    throw new Error(inspectUsage);
  }
  return value;
};

const parseInspectArgs = (args: string[]): InspectArgs => {
  let strategy: InspectStrategy = "nested";
  const positionals: string[] = [];

  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === "--strategy" || arg === "-s") {
      strategy = parseInspectStrategy(args[++index]);
    } else {
      positionals.push(arg!);
    }
  }

  if (positionals.length !== 1) {
    throw new Error(inspectUsage);
  }

  return { filePath: positionals[0]!, strategy };
};

const reducerOf = (strategy: InspectStrategy): DirectiveReducer | null => {
  switch (strategy) {
    case "nested":
      return DirectiveJSONEncoder.nestedReducer;
    case "tuple":
      return DirectiveJSONEncoder.tupleReducer;
    case "raw":
      return null;
  }
};

const runInspect = async (args: string[]): Promise<number> => {
  const { filePath, strategy } = parseInspectArgs(args);

  const source = await readFile(filePath, "utf8");
  const directive = DON.parse(source);
  const encoded = new DirectiveJSONEncoder().encode(directive, {
    reducer: reducerOf(strategy),
  });

  console.log(JSON.stringify(encoded, null, 2));

  return 0;
};

const main = async (): Promise<number> => {
  const [command, ...rest] = process.argv.slice(2);

  switch (command) {
    case "lint":
      return runLint(rest);
    case "inspect":
      return runInspect(rest);
    default:
      console.error(topLevelUsage);
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
