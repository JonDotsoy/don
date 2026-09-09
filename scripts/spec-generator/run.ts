import * as fs from "node:fs";
import * as path from "node:path";
import { compileSpec } from "./compile.ts";
import { renderDocument } from "./render.ts";

const DEFAULT_INPUT = "docs/specs/v1/_generator_specs.ts";

const defaultOutputFor = (input: string): string =>
  input.replace(/_generator_specs\.ts$/, "spec.generated.md");

export const generateSpec = async (
  inputPath: string,
  outputPath?: string,
): Promise<{ output: string; markdown: string }> => {
  const input = path.resolve(inputPath);
  const output = path.resolve(outputPath ?? defaultOutputFor(input));

  const { meta, fragments } = await compileSpec(input);
  const markdown = renderDocument(meta, fragments);

  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, markdown);

  return { output, markdown };
};

const main = async () => {
  const [, , inputArg, outputArg] = process.argv;
  const { output } = await generateSpec(inputArg ?? DEFAULT_INPUT, outputArg);
  console.log(`Generated ${path.relative(process.cwd(), output)}`);
};

if (import.meta.main) {
  main();
}
