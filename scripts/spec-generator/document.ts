import { defaultFormatters } from "./formatters.ts";
import {
  isBlockEvalOptions,
  type Block,
  type BlockOptions,
  type BlockTag,
  type Formatter,
  type MdLine,
  type StoredBlock,
  type TemplateArgs,
} from "./types.ts";

const renderTemplate = (...[strings, ...values]: TemplateArgs): string =>
  strings.reduce(
    (acc, part, i) => acc + part + (i < values.length ? String(values[i]) : ""),
    "",
  );

/** Strips a single leading/trailing blank line left by a template literal's own newlines. */
const trimBlockRaw = (raw: string): string =>
  raw.replace(/^\n/, "").replace(/\n[ \t]*$/, "");

const fence = (lang: string, content: string): string =>
  `\`\`\`${lang}\n${content}\n\`\`\``;

const noop: BlockTag = () => {};

/**
 * Accumulates the ordered markdown fragments produced by a `_generator_specs.ts`
 * file's `mdLine`/`block` calls, and renders them into a single document body.
 */
export class SpecDocument {
  #fragments: string[] = [];
  #blocks = new Map<string, StoredBlock>();
  #formatters: Record<string, Formatter>;

  constructor(formatters: Record<string, Formatter> = defaultFormatters) {
    this.#formatters = formatters;
  }

  mdLine: MdLine = (...args) => {
    this.#fragments.push(renderTemplate(...args).trim());
  };

  block: Block = (options: BlockOptions) => {
    if (isBlockEvalOptions(options)) {
      this.#renderEvalBlock(options.evalBlock, options.format);
      return noop;
    }

    const { key, lang } = options;

    return (...args) => {
      const raw = trimBlockRaw(renderTemplate(...args));
      this.#blocks.set(key, { lang, raw });
      this.#fragments.push(fence(lang, raw));
    };
  };

  #renderEvalBlock(key: string, format: string) {
    const stored = this.#blocks.get(key);
    if (!stored) {
      throw new Error(
        `block(): no stored block found for key "${key}". Register it first with block({ key: "${key}", lang: ... })\`...\`.`,
      );
    }

    const formatter = this.#formatters[format];
    if (!formatter) {
      throw new Error(
        `block(): no formatter registered for format "${format}". Known formats: ${Object.keys(this.#formatters).join(", ")}.`,
      );
    }

    this.#fragments.push(fence(format, formatter(stored.raw)));
  }

  get fragments(): readonly string[] {
    return this.#fragments;
  }

  toMarkdown(): string {
    return this.#fragments.join("\n\n") + "\n";
  }
}
