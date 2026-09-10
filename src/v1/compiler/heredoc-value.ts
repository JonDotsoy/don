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
      body.slice(newlineIndex + 1),
    );
  }
}
