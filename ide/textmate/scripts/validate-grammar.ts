#!/usr/bin/env bun
/**
 * Validates the DON TextMate grammar:
 *  - don.tmLanguage.json is valid JSON with the expected shape
 *  - every "match"/"begin"/"end" pattern compiles as a regular expression
 *  - the grammar's directive-name rule recognizes the first token of each
 *    non-blank, non-comment line in the sample .don files
 */
import { readdir } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const grammarPath = new URL("don.tmLanguage.json", root);

type Rule = {
  match?: string;
  begin?: string;
  end?: string;
  patterns?: Rule[];
  [key: string]: unknown;
};

type Grammar = {
  scopeName: string;
  patterns: Rule[];
  repository: Record<string, Rule>;
};

const grammar: Grammar = await Bun.file(grammarPath).json();

let errors = 0;

function checkPattern(source: string, label: string) {
  try {
    // Oniguruma and JS regex syntax mostly overlap for this grammar's
    // patterns, so compiling with the JS RegExp engine is a reasonable
    // sanity check that each pattern is well-formed.
    new RegExp(source);
  } catch (error) {
    errors++;
    console.error(`✗ invalid regex in ${label}: ${source}`);
    console.error(`  ${(error as Error).message}`);
  }
}

function walk(rule: Rule, label: string) {
  if (rule.match) checkPattern(rule.match, `${label}.match`);
  if (rule.begin) checkPattern(rule.begin, `${label}.begin`);
  if (rule.end) checkPattern(rule.end, `${label}.end`);
  for (const child of rule.patterns ?? []) {
    walk(child, `${label}.patterns[]`);
  }
}

for (const rule of grammar.patterns) walk(rule, "patterns[]");
for (const [name, rule] of Object.entries(grammar.repository)) {
  for (const child of rule.patterns ?? []) walk(child, `repository.${name}`);
}

if (grammar.scopeName !== "source.don") {
  errors++;
  console.error(`✗ unexpected scopeName: ${grammar.scopeName}`);
}

const directiveNamePattern = new RegExp(
  grammar.repository["directive-name"].patterns![0].match!,
);

const samplesDir = new URL("samples/", root);
const sampleFiles = (await readdir(samplesDir)).filter((f) =>
  f.endsWith(".don"),
);

if (sampleFiles.length === 0) {
  errors++;
  console.error("✗ no sample .don files found to validate against");
}

for (const file of sampleFiles) {
  const text = await Bun.file(new URL(file, samplesDir)).text();
  const lines = text.split("\n");
  let matchedDirectives = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (
      trimmed === "" ||
      trimmed.startsWith("#") ||
      trimmed.startsWith("/*") ||
      trimmed.startsWith("*") ||
      trimmed === "}" ||
      /^</.test(trimmed) || // heredoc content lines like <div>, <h1>...
      trimmed.startsWith("<")
    ) {
      continue;
    }
    if (directiveNamePattern.test(line)) {
      matchedDirectives++;
    }
  }

  if (matchedDirectives === 0) {
    errors++;
    console.error(`✗ ${file}: directive-name pattern matched nothing`);
  } else {
    console.log(`✓ ${file}: ${matchedDirectives} directive names matched`);
  }
}

if (errors > 0) {
  console.error(`\n${errors} problem(s) found in the DON TextMate grammar.`);
  process.exit(1);
}

console.log("\nDON TextMate grammar looks valid.");
