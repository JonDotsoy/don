const inspectSymbol = Symbol.for("nodejs.util.inspect.custom");

// Mirrors the `DirectiveInspectView` trick in don.ts: some runtimes
// (e.g. `Bun.inspect`) print a class's own methods (`toString`,
// `toJSON`) as if they were enumerable data properties. Returning an
// instance of this plain, method-less view from `[inspectSymbol]`
// keeps the inspected output to just `descriptor`/`content` while still
// tagging it "HeredocValue".
const HeredocInspectView = (() => {
  class HeredocValue {
    constructor(
      readonly descriptor: unknown,
      readonly content: unknown,
    ) {}
  }
  return HeredocValue;
})();

/**
 * Parsed value of a heredoc token (`<<<DESCRIPTOR\n...body...`), split into
 * the opening descriptor (`descriptor`, `null` when omitted) and the raw
 * body that follows it (`content`). The descriptor is a free-form label
 * describing the content (e.g. `HTML`, `BASH`); it does not delimit anything.
 */
export class HeredocValue {
  constructor(
    readonly descriptor: string | null,
    readonly content: string,
  ) {}

  /**
   * @deprecated Use {@link HeredocValue.descriptor}. This alias is renamed to
   * `deprecated_delimiter` on 2027-01-04 (3 months after 2026-10-04) and
   * removed entirely on 2027-04-04 (6 months after 2026-10-04).
   */
  get delimiter(): string | null {
    return this.descriptor;
  }

  toString(): string {
    return this.content;
  }

  toJSON() {
    return this.content;
  }

  [inspectSymbol]() {
    return new HeredocInspectView(this.descriptor, this.content);
  }

  /** Parses the raw text of a heredoc token, e.g. `<<<HTML\n<div/>\n`. */
  static parse(raw: string): HeredocValue {
    const body = raw.slice(3);
    const newlineIndex = body.indexOf("\n");

    if (newlineIndex === -1) return new HeredocValue(body || null, "");

    const descriptor = body.slice(0, newlineIndex);

    return new HeredocValue(
      descriptor || null,
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
