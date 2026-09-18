import { Directive } from "../don.js";
import { ROOT_DIRECTIVE_NAME, wrapAsRoot } from "../directive-json.js";
import { Scope, bindSet, resolveScopedArg } from "./scope.js";

// Processes one block's worth of siblings against a single, shared
// `blockScope`: a `set` mutates it (and is dropped), everything else is
// resolved against it and recurses into its own fresh child scope.
const transformSiblings = (
  siblings: readonly Directive[],
  blockScope: Scope,
): Directive[] => {
  const resolved: Directive[] = [];

  for (const sibling of siblings) {
    if (sibling.name === "set") {
      bindSet(sibling.args, blockScope);
      continue;
    }

    resolved.push(transform(sibling, blockScope));
  }

  return resolved;
};

const transform = (directive: Directive, enclosingScope: Scope): Directive =>
  new Directive(
    directive.name,
    directive.args.map((arg) => resolveScopedArg(arg, enclosingScope)),
    transformSiblings(directive.children, new Scope(enclosingScope)),
  );

/**
 * Resolves `set`/`$name`/`${name}` variables over an already-parsed
 * `Directive` tree, with `set` **block-scoped**: a `set` inside a block
 * shadows one of the same name from an enclosing block for the rest of
 * that inner block, then reverts once the block ends (see
 * `docs/concepts/references.md`'s "Decided: `set` is block-scoped").
 *
 * This is a standalone tree transform, run *after* `DON.parse()` rather
 * than as a `DonPlugin` passed to it — useful when the tree didn't come
 * from `DON.parse()` at all (e.g. one built by `DirectiveJSONDecoder`,
 * or assembled by hand). If you're resolving variables in a document
 * you're about to parse with `DON.parse()` itself, prefer
 * `scopedVariablesPlugin` instead (`./scoped-variables-plugin.js`) —
 * same rules, same shared `Scope`, but wired into `DON.parse(text, {
 * plugins: [scopedVariablesPlugin] })` via the `onDirective`/
 * `afterChildren` push/pop hooks instead of this function's own
 * recursion:
 *
 * ```don
 * set foo 33
 *
 * foo $foo
 * tar biz {
 *   set foo 55
 *   foo $foo
 * }
 * ```
 *
 * resolves to a root wrapping `Directive{name:"foo", args:[33]}` and
 * `Directive{name:"tar", args:["biz"], children:[
 *   Directive{name:"foo", args:[55]}
 * ]}` — the inner `set foo 55` only reaches `foo $foo` inside `tar`'s own
 * block; `set` directives themselves are dropped from the result, same
 * as `variablesPlugin` drops them.
 *
 * A bare `$name` argument (no braces) substitutes the whole value,
 * unchanged in type (a `set foo 33` bound `Number`, not `"33"`). A
 * `${name}` occurrence inside a larger string argument is interpolated
 * into that string as text (`String(value)`), e.g.
 * `"${project}-container-1"` with `set project "FOO"` becomes
 * `"FOO-container-1"`. `\${name}` (backslash-escaped) is left as the
 * literal text `${name}`, never interpolated.
 */
export const resolveScopedVariables = (root: Directive): Directive => {
  const rootScope = new Scope();

  // `DON.parse()` only wraps top-level directives in a synthetic
  // `ROOT_DIRECTIVE_NAME` root when there's more than one — a single
  // top-level directive comes back unwrapped (see the README's "AST"
  // section). Re-deriving that same rule here, against the *resolved*
  // top-level list, keeps a document that drops down to zero or one
  // top-level directive (its only directive was a `set`, or a `set`
  // alongside one other directive) shaped the same way a document
  // written that way from the start would be.
  if (root.name !== ROOT_DIRECTIVE_NAME) {
    if (root.name === "set") return wrapAsRoot([]);
    return transform(root, rootScope);
  }

  return wrapAsRoot(transformSiblings(root.children, rootScope));
};
