export type TemplateArgs = [
  strings: TemplateStringsArray,
  ...values: unknown[],
];

/** Tagged-template function used to append a markdown line/paragraph. */
export type MdLine = (...args: TemplateArgs) => void;

/**
 * `tableOfContents()` inserts a table of contents linking every `##`-`######`
 * heading in the document — including headings emitted after this call.
 */
export type TableOfContents = () => void;

/**
 * `block({ key, lang })` registers a fenced code block: the tagged template
 * body is rendered verbatim as a ```lang fence and stored under `key` so a
 * later `block({ evalBlock: key, format })` can evaluate it.
 */
export interface BlockKeyOptions {
  key: string;
  lang: string;
}

/**
 * `block({ evalBlock, format })` evaluates a previously stored block
 * (registered via `{ key }`) and renders the result as a ```format fence.
 * Evaluation happens immediately when `block(...)` is called — the returned
 * tag function is a no-op stub kept only so the call signature stays
 * consistent with the `{ key }` form.
 */
export interface BlockEvalOptions {
  evalBlock: string;
  format: string;
}

export type BlockOptions = BlockKeyOptions | BlockEvalOptions;

export type BlockTag = (...args: TemplateArgs) => void;

/** `block(options)` always returns a tag function, per the DSL contract. */
export type Block = (options: BlockOptions) => BlockTag;

export const isBlockEvalOptions = (
  options: BlockOptions,
): options is BlockEvalOptions => "evalBlock" in options;

/** A stored block payload, keyed by `block({ key, lang })`. */
export interface StoredBlock {
  lang: string;
  raw: string;
}

/** Metadata a `_generator_specs.ts` file must export. */
export interface GeneratorModule {
  status: string;
  title: string;
  description: string;
  lang: string;
}

/** Converts a stored block's raw text into rendered output for `format`. */
export type Formatter = (raw: string) => string;
