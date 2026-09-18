import type { HeredocValue } from "./v1/compiler/heredoc-value.js";

/**
 * A directive as seen by a plugin, mid-parse: its resolved `name`/`args`
 * (the same shape a built `Directive` exposes), not yet frozen into a
 * `Directive` or attached to a tree. Readonly — a plugin never mutates
 * one of these in place; it returns a new `PluginDirectiveNode` from
 * `onDirective` instead (see there).
 *
 * `children`, when present, replaces this directive's children in the
 * resulting `Directive` entirely — the source directive's own children
 * (if it had any) are discarded in favor of this synthetic subtree, built
 * directly into `Directive`s without going through the lexer/syntax
 * parser or any plugin again. Leave it `undefined` (the default for a
 * directive straight off the parser) to keep the source's own children,
 * parsed and run through the plugin pipeline as usual.
 */
export interface PluginDirectiveNode {
  readonly name: string | symbol;
  readonly args: readonly (number | string | boolean | HeredocValue)[];
  readonly children?: readonly PluginDirectiveNode[];
}

/**
 * A `DON.parse(text, { plugins })` extension. `onDirective` runs once per
 * directive, depth-first pre-order (a parent before its children, an
 * earlier sibling before a later one) — the same order the document reads
 * in, so a plugin can build up `ctx` incrementally as it goes.
 *
 * `TContext` is entirely up to the plugin — there's no required shape for
 * it, since it's only ever handed back to that same plugin's own
 * `onDirective`: a plain object, a `Map`, an array, a class instance, or
 * no `ctx` at all.
 */
export interface DonPlugin<TContext = unknown> {
  readonly name: string;

  /**
   * Builds this plugin's own `ctx`, called once per `DON.parse()` call,
   * before any directive is visited. A plugin that defines no
   * `initContext` gets `ctx: undefined` in every `onDirective` call — it's
   * only there for a plugin that actually needs state across directives.
   * Whichever value this returns is never shared with another plugin's
   * `ctx`, so plugins can't collide on the same state.
   */
  initContext?(): TContext;

  /**
   * Called for every directive node before it's built into a `Directive`.
   * `node` is never mutated in place — to change what gets built (e.g.
   * resolving a `$foo` variable reference to its value), return a new
   * `PluginDirectiveNode` instead. Return `null` to drop this directive —
   * and its children — from the resulting tree entirely, e.g. a `set`
   * pragma that only has a side effect on `ctx`. Return nothing (`void`)
   * to leave `node` as-is.
   */
  onDirective?(
    node: PluginDirectiveNode,
    ctx: TContext,
  ): PluginDirectiveNode | null | void;

  /**
   * Called once per directive, right after all of its children have
   * been fully visited (their own `onDirective`/`afterChildren` calls
   * already ran) and right before this directive itself is built into a
   * `Directive`. `node` is this directive's own name/args, exactly as
   * `onDirective` (from this plugin, and any other plugin's rewrite of
   * it) left them — never the children themselves, and never mutated.
   *
   * This is the "block ended" signal `onDirective` alone doesn't have:
   * `onDirective` only fires *before* a directive's children are
   * visited, so a plugin that pushes some state in `onDirective` (e.g. a
   * new scope layer for `set`-bound variables) has no way, from
   * `onDirective` alone, to know when to pop it again — `afterChildren`
   * is that matching pop point. See `scopedVariablesPlugin`
   * (`src/plugins/scoped-variables-plugin.ts`) for a plugin built on
   * exactly this push/pop pattern.
   *
   * Never called for a directive whose `onDirective` (from this plugin
   * or an earlier one in the `plugins` array) returned `null` — a
   * dropped directive's children are never visited at all, so there's
   * nothing to signal the end of.
   */
  afterChildren?(node: PluginDirectiveNode, ctx: TContext): void;
}
