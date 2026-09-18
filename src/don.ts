import { DirectiveNode, DocumentNode } from "./v1/compiler/directive-node.js";
import { SyntaxParser } from "./v1/compiler/syntax-encode.js";
import { directiveToJSON, wrapAsRoot } from "./directive-json.js";
import { HeredocValue } from "./v1/compiler/heredoc-value.js";
import {
  atDirective,
  findAllDirectives,
  findDirective,
  type AtPathResult,
} from "./find.js";
import type { Token } from "./v1/compiler/token.js";
import type { DonPlugin, PluginDirectiveNode } from "./plugin.js";

export { HeredocValue } from "./v1/compiler/heredoc-value.js";
export type { DonPlugin, PluginDirectiveNode } from "./plugin.js";

// Keyed by the Directive instance so the tokens don't leak into its
// public shape (name/args/children) or get carried over JSON/decoder
// round-trips, and are garbage-collected along with the Directive.
const tokensByDirective = new WeakMap<Directive, Token[]>();

// Keyed by the child Directive instance so the parent link doesn't leak
// into its public shape or create a reference cycle. Populated in the
// constructor itself (from `children`), so it's set for every Directive
// regardless of how it was built — parsed, decoded from JSON, or
// constructed by hand — and always reflects the last Directive a given
// instance was attached to as a child.
const parentByDirective = new WeakMap<Directive, Directive>();

const inspectSymbol = Symbol.for("nodejs.util.inspect.custom");

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
  ) {
    for (const child of children) {
      parentByDirective.set(child, this);
    }
  }

  /**
   * This `Directive`'s immediate parent in the tree it was last attached
   * to as a child, or `undefined` for a top-level/root `Directive` with
   * no enclosing parent.
   *
   * Set from `children` by the constructor itself, so it's available for
   * any `Directive`, however it was built: parsed by `DON.parse()`,
   * decoded from JSON, or constructed by hand with `new Directive(...)`.
   */
  get parent(): Directive | undefined {
    return parentByDirective.get(this);
  }

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

  /**
   * The first directive matching an absolute path from `this` directive
   * (treated as the document root); see `findAllDirectives` for the path
   * syntax. `undefined` if none match.
   */
  find(path: string): Directive | undefined {
    return findDirective(this, path);
  }

  /**
   * Every directive matching an absolute path from `this` directive
   * (treated as the document root); see `findAllDirectives` for the path
   * syntax.
   */
  findAll(path: string): Directive[] {
    return findAllDirectives(this, path);
  }

  /**
   * Resolves an absolute path from `this` directive (treated as the
   * document root); see `findAllDirectives` for the path syntax. A path
   * ending in `[N]` (e.g. `"/server/route(/home)[1]"`) returns that
   * directive's argument at position `N` instead of the directive itself
   * — reflected in the return type for a string-literal path.
   * **Positions are 1-based**: `[1]` is the first argument.
   */
  at<P extends string>(path: P): AtPathResult<P> {
    return atDirective(this, path);
  }
}

// Builds a `Directive` straight from a plugin-supplied `PluginDirectiveNode`
// subtree — used for synthetic `children` a plugin injects (see
// `PluginDirectiveNode#children`), which never go through the lexer/syntax
// parser or another plugin, so they carry no `Token`s of their own.
const pluginNodeToDirective = (node: PluginDirectiveNode): Directive =>
  new Directive(
    node.name,
    [...node.args],
    (node.children ?? []).map(pluginNodeToDirective),
  );

const toDirective = (
  node: DirectiveNode,
  plugins: DonPlugin[],
  pluginContexts: Map<DonPlugin, unknown>,
): Directive | undefined => {
  let pluginNode: PluginDirectiveNode = {
    name: node.name.text(),
    args: node.args.map((token) => token.toJS()),
  };

  for (const plugin of plugins) {
    const ctx = pluginContexts.get(plugin);
    const result = plugin.onDirective?.(pluginNode, ctx);
    if (result === null) return undefined;
    if (result) pluginNode = result;
  }

  const children = pluginNode.children
    ? pluginNode.children.map(pluginNodeToDirective)
    : node.children.flatMap((child) => {
        const childDirective = toDirective(child, plugins, pluginContexts);
        return childDirective ? [childDirective] : [];
      });

  // Fires only once every child (if any) has been fully visited — the
  // "block ended" signal `onDirective` alone can't give a plugin, since
  // it only ever runs before descending into children. Skipped entirely
  // above via the early `return undefined` when a plugin drops this
  // directive, so a dropped directive's children are never visited and
  // never get this signal either.
  for (const plugin of plugins) {
    plugin.afterChildren?.(pluginNode, pluginContexts.get(plugin));
  }

  const directive = new Directive(
    pluginNode.name,
    [...pluginNode.args],
    children,
  );
  tokensByDirective.set(directive, [node.name, ...node.args]);
  return directive;
};

const docToDirective = (
  node: DocumentNode,
  plugins: DonPlugin[],
  pluginContexts: Map<DonPlugin, unknown>,
): Directive =>
  wrapAsRoot(
    node.children.flatMap((child) => {
      const directive = toDirective(child, plugins, pluginContexts);
      return directive ? [directive] : [];
    }),
  );

export interface DONParseOptions {
  /**
   * Extensions run over each directive, depth-first pre-order, as the
   * document is parsed — see `DonPlugin`. They can transform a
   * directive's args (e.g. resolve a `$foo` variable reference) or drop
   * it from the resulting tree entirely (e.g. a `set` pragma).
   */
  plugins?: DonPlugin[];
}

export class DON {
  static parse(text: string, options: DONParseOptions = {}): Directive {
    const { plugins = [] } = options;
    const documentNode = new SyntaxParser().parse(text);
    // Every plugin gets its own `ctx` — built once per `DON.parse()` call,
    // from `initContext()` when the plugin defines it, otherwise
    // `undefined` — never shared with another plugin's.
    const pluginContexts = new Map<DonPlugin, unknown>(
      plugins.map((plugin) => [plugin, plugin.initContext?.()]),
    );

    return docToDirective(documentNode, plugins, pluginContexts);
  }
}
