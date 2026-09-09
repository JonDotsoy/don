import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

const SRC_INDEX = path.resolve(import.meta.dirname, "../../src/index.ts");
const SRC_DIRECTIVE_JSON = path.resolve(
  import.meta.dirname,
  "../../src/directive-json.ts",
);

const PLACEHOLDER = /\/\/\s*\{code_response\}/g;
const TS_CODE_BLOCK = /```ts\n([\s\S]*?)\n```/g;

/** Rewrites `donly`/`donly/encoder`/`donly/decoder` imports to the local
 * source files so example snippets run against the current source tree
 * instead of a published (or unbuilt) package. */
const resolveLocalImports = (code: string): string =>
  code
    .replace(
      /(["'])donly\/(encoder|decoder)\1/g,
      JSON.stringify(SRC_DIRECTIVE_JSON),
    )
    .replace(/(["'])donly\1/g, JSON.stringify(SRC_INDEX));

const OUTPUT_SEPARATOR = "";

/** Wraps a snippet so every `console.log` call is captured as one
 * JSON-stringified, single-line entry instead of letting Bun's own
 * (possibly multi-line) pretty-printer decide the output shape. */
const withCaptureHarness = (code: string): string => `
const __donlyDocOutputs__: string[] = [];
const __donlyDocRealLog__ = console.log.bind(console);
console.log = (...args: unknown[]) => {
  __donlyDocOutputs__.push(
    args
      .map((arg) =>
        typeof arg === "string" ? arg : JSON.stringify(arg).replace(/,/g, ", "),
      )
      .join(" "),
  );
};

${resolveLocalImports(code)}

__donlyDocRealLog__(__donlyDocOutputs__.join(${JSON.stringify(OUTPUT_SEPARATOR)}));
`;

/** Runs a TypeScript snippet with Bun and returns the JSON-stringified
 * value passed to each `console.log` call, in order. */
const runSnippet = (code: string): string[] => {
  const tmpFile = path.join(
    os.tmpdir(),
    `donly-doc-example-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}.ts`,
  );
  fs.writeFileSync(tmpFile, withCaptureHarness(code));
  try {
    const stdout = execFileSync("bun", ["run", tmpFile], {
      encoding: "utf8",
    });
    return stdout.trimEnd().split(OUTPUT_SEPARATOR);
  } finally {
    fs.rmSync(tmpFile, { force: true });
  }
};

/**
 * Executes every fenced `ts` code block that contains a `// {code_response}`
 * placeholder and substitutes each placeholder, in order, with the actual
 * `console.log` output produced when the snippet runs — so documented
 * results are verified against real code instead of hand-written text.
 */
export const fillCodeResponses = (mdx: string): string =>
  mdx.replace(TS_CODE_BLOCK, (block, code: string) => {
    if (!PLACEHOLDER.test(code)) return block;

    const outputs = runSnippet(code);
    let next = 0;
    const filled = code.replace(PLACEHOLDER, () => {
      if (next >= outputs.length) {
        throw new Error(
          `Not enough console.log output to fill all {code_response} placeholders in:\n${code}`,
        );
      }
      return `// ${outputs[next++]}`;
    });

    return "```ts\n" + filled + "\n```";
  });
