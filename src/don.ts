import { DirectiveNode, DocumentNode } from "./v1/compiler/directive-node.js";
import { SyntaxParser } from "./v1/compiler/syntax-encode.js";
import { directiveToJSON, wrapAsRoot } from "./directive-json.js";
import { HeredocValue } from "./v1/compiler/heredoc-value.js";
import type { Token } from "./v1/compiler/token.js";

export { HeredocValue } from "./v1/compiler/heredoc-value.js";

// Keyed by the Directive instance so the tokens don't leak into its
// public shape (name/args/children) or get carried over JSON/decoder
// round-trips, and are garbage-collected along with the Directive.
const tokensByDirective = new WeakMap<Directive, Token[]>();

const inspectSymbol = Symbol.for("nodejs.util.inspect.custom");

/** A directive's source span, as absolute character offsets into the parsed text. */
export interface Loc {
  start: number;
  end: number;
}

// A plain data-only view used only for inspection: returning an
// instance of it from `[inspectSymbol]` (instead of a pre-formatted
// string) lets the engine's own inspector recurse into it — and
// therefore indent nested Directives correctly — while showing only
// name/args/children. It's declared as its own "Directive" class (in
// this closure, distinct from the exported one below) purely so
// util.inspect/Bun.inspect tags the output "Directive { ... }".
const DirectiveInspectView = (() => {
  class Directive {
    constructor(
      readonly name: unknown,
      readonly args: unknown,
      readonly children: unknown,
    ) {}
  }
  return Directive;
})();

export class Directive {
  constructor(
    readonly name: string | symbol,
    readonly args: (number | string | boolean | HeredocValue)[],
    readonly children: Directive[] = [],
    /** Absent for synthetic directives (e.g. the multi-root wrapper). */
    readonly loc?: Loc,
  ) {}

  toJSON(): unknown {
    return directiveToJSON(this);
  }

  /**
   * Some runtimes (e.g. `Bun.inspect` under `bun -e`) print `toJSON` as
   * an own enumerable property instead of hiding it like a regular
   * class method. Returning a `DirectiveInspectView` here hides it
   * without losing the engine's own (correctly indented) recursive
   * formatting of nested Directives.
   */
  [inspectSymbol]() {
    return new DirectiveInspectView(this.name, this.args, this.children);
  }

  /**
   * The `Token`s (the directive's own name and args, not its children's)
   * that a `Directive` returned by `DON.parse()` was built from, or
   * `undefined` for a `Directive` not produced by the parser (e.g. one
   * built by hand or by `DirectiveJSONDecoder`).
   */
  static tokensByDirective(directive: Directive): Token[] | undefined {
    return tokensByDirective.get(directive);
  }
}

const toDirective = (node: DirectiveNode): Directive => {
  const directive = new Directive(
    node.name.text(),
    node.args.map((token) => token.toJS()),
    node.children.map((child) => toDirective(child)).flat(),
    // `DirectiveNode#span.length` is already an absolute end offset, not a length.
    { start: node.span.index, end: node.span.length },
  );
  tokensByDirective.set(directive, [node.name, ...node.args]);
  return directive;
};

const docToDirective = (node: DocumentNode): Directive =>
  wrapAsRoot(node.children.map((child) => toDirective(child)));

export class DON {
  static parse(text: string): Directive {
    const documentNode = new SyntaxParser().parse(text);

    return docToDirective(documentNode);
  }
}
