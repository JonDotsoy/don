import type { DonPlugin } from "../plugin.js";
import { Scope, bindSet, resolveScopedArg } from "./scope.js";

interface ScopedVariablesContext {
  /**
   * The scope for whichever block is currently being visited — always
   * at least one entry (the document's own top-level scope, seeded by
   * `initContext`). `onDirective` reads `.at(-1)` as this directive's
   * *enclosing* scope, then pushes a fresh one (chained to it) for this
   * directive's own children; `afterChildren` pops that same entry back
   * off once every one of those children has been visited. A dropped
   * directive (this plugin's `set` handling, or an earlier/later
   * plugin returning `null`) never gets to `afterChildren` at all — see
   * `DonPlugin#afterChildren`'s own doc comment in `../plugin.js` — so
   * nothing is pushed for it in the first place either.
   */
  stack: Scope[];
}

/**
 * A `DonPlugin` sibling of `resolveScopedVariables`
 * (`./scoped-variables-resolver.js`), for resolving the same `set`/
 * `$name`/`${name}` variables — **block-scoped**, same as that
 * function — directly inside `DON.parse()`, instead of as a separate
 * pass over an already-built `Directive` tree:
 *
 * ```ts
 * import { DON } from "donly";
 * import { scopedVariablesPlugin } from "donly/plugins/scoped-variables";
 *
 * const result = DON.parse(payload, { plugins: [scopedVariablesPlugin] });
 * ```
 *
 * This only became possible with `DonPlugin#afterChildren` (see its own
 * doc comment): `onDirective` alone fires once per directive, before
 * its children are visited, with no matching "this block's children
 * are all done" signal — enough for a flat, document-wide variable
 * table (see `variablesPlugin` in `../demo/plugins/variables-plugin.js`),
 * but not enough to *restore* a shadowed value once the block that
 * shadowed it ends. `afterChildren` is exactly that missing signal:
 * `onDirective` pushes a new `Scope` (chained to the current one) right
 * before this directive's own children get visited, and `afterChildren`
 * pops it back off right after they're done — so a `set` bound inside
 * that scope never outlives the block it was written in.
 *
 * Same resolution rules as `resolveScopedVariables`: a bare `$name`
 * substitutes the whole argument, unchanged in type; a `${name}`
 * occurrence inside a larger string argument is interpolated as text;
 * `\${name}` is left as the literal text `${name}`; `set` directives
 * are dropped from the result. See
 * [Scoped Variables](../../docs/plugins/scoped-variables.md) for the
 * full walkthrough and the error cases this plugin's `onDirective`
 * throws on (an unbound variable, a malformed `set`, interpolating a
 * heredoc).
 */
export const scopedVariablesPlugin: DonPlugin<ScopedVariablesContext> = {
  name: "scoped-variables",

  initContext: () => ({ stack: [new Scope()] }),

  onDirective(node, ctx) {
    const enclosingScope = ctx.stack.at(-1)!;
    const args = node.args.map((arg) => resolveScopedArg(arg, enclosingScope));

    if (node.name === "set") {
      bindSet(args, enclosingScope);
      return null;
    }

    // Pushed here, popped in `afterChildren` below — the scope this
    // directive's own children (if it has any) resolve against.
    ctx.stack.push(new Scope(enclosingScope));

    return { name: node.name, args };
  },

  afterChildren(_node, ctx) {
    ctx.stack.pop();
  },
};
