import * as fs from "node:fs";
import * as path from "node:path";
import { mdxToMarkdown } from "./convert.ts";

const DEFAULT_INPUT = "README.mdx";

const defaultOutputFor = (input: string): string =>
  input.replace(/\.mdx$/, ".md");

export const generateDocs = (
  inputPath: string,
  outputPath?: string,
): { output: string; markdown: string } => {
  const input = path.resolve(inputPath);
  const output = path.resolve(outputPath ?? defaultOutputFor(input));

  const mdx = fs.readFileSync(input, "utf8");
  const markdown = mdxToMarkdown(mdx);

  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, markdown);

  return { output, markdown };
};

const main = () => {
  const [, , inputArg, outputArg] = process.argv;
  const { output } = generateDocs(inputArg ?? DEFAULT_INPUT, outputArg);
  console.log(`Generated ${path.relative(process.cwd(), output)}`);
};

if (import.meta.main) {
  main();
}
