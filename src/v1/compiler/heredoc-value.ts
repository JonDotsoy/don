const inspectSymbol = Symbol.for("nodejs.util.inspect.custom");

// Mirrors the `DirectiveInspectView` trick in don.ts: some runtimes
// (e.g. `Bun.inspect`) print a class's own methods (`toString`,
// `toJSON`) as if they were enumerable data properties. Returning an
// instance of this plain, method-less view from `[inspectSymbol]`
// keeps the inspected output to just `type`/`content` while still
// tagging it "HeredocValue".
const HeredocInspectView = (() => {
  class HeredocValue {
    constructor(
      readonly type: unknown,
      readonly content: unknown,
    ) {}
  }
  return HeredocValue;
})();

/**
 * Parsed value of a heredoc token (`<<<DELIM\n...body...`), split into
 * the opening delimiter (`type`) and the raw body that follows it
 * (`content`).
 */
export class HeredocValue {
  constructor(
    readonly type: string,
    readonly content: string,
  ) {}

  toString(): string {
    return this.content;
  }

  toJSON() {
    return { type: this.type, content: this.content };
  }

  [inspectSymbol]() {
    return new HeredocInspectView(this.type, this.content);
  }

  /** Parses the raw text of a heredoc token, e.g. `<<<HTML\n<div/>\n`. */
  static parse(raw: string): HeredocValue {
    const body = raw.slice(3);
    const newlineIndex = body.indexOf("\n");

    if (newlineIndex === -1) return new HeredocValue(body, "");

    return new HeredocValue(
      body.slice(0, newlineIndex),
      dedent(body.slice(newlineIndex + 1)),
    );
  }
}

/**
 * Strips the common leading whitespace shared by every non-blank line,
 * so a heredoc's own indentation (inherited from its position in the
 * source) doesn't leak into its content. Blank lines are ignored when
 * computing the margin and are normalized to empty lines.
 */
const dedent = (content: string): string => {
  const lines = content.split("\n");

  let margin: number | null = null;
  for (const line of lines) {
    if (line.trim() === "") continue;
    const leadingWhitespace = line.match(/^[ \t]*/)?.[0].length ?? 0;
    if (margin === null || leadingWhitespace < margin)
      margin = leadingWhitespace;
  }

  if (!margin) return content;

  return lines
    .map((line) => (line.trim() === "" ? "" : line.slice(margin)))
    .join("\n");
};
