import { Directive, type HeredocValue } from "../../don.js";
import { ROOT_DIRECTIVE_NAME, wrapAsRoot } from "../../directive-json.js";

type Value = number | string | boolean | HeredocValue;

const BARE_VARIABLE_PATTERN = /^\$([A-Za-z_][A-Za-z0-9_-]*)$/;
const TEMPLATE_PATTERN = /(\\)?\$\{([A-Za-z_][A-Za-z0-9_-]*)\}/g;

/**
 * A `set`-bound name lookup, chained to the block it was declared in.
 * `get` walks outward — this scope first, then its parent, and so on —
 * so a `set` in a nested block shadows one of the same name from an
 * enclosing block only for as long as that nested block lasts.
 */
class Scope {
  private readonly bindings = new Map<string, Value>();

  constructor(private readonly parent?: Scope) {}

  set(name: string, value: Value): void {
    this.bindings.set(name, value);
  }

  get(name: string): Value | undefined {
    if (this.bindings.has(name)) return this.bindings.get(name);
    return this.parent?.get(name);
  }
}

const stringifiable = (value: Value): value is number | string | boolean =>
  typeof value !== "object";

const interpolate = (text: string, scope: Scope): string =>
  text.replace(TEMPLATE_PATTERN, (whole, escaped, name) => {
    // `\${name}` (escaped) is the literal text `${name}` — the leading
    // backslash is dropped, same as `\"`/`\'` already escape a string's
    // own delimiter (see docs/specs/v1/spec.md#25-strings).
    if (escaped) return whole.slice(1);

    const value = scope.get(name);
    if (value === undefined) {
      throw new Error(`Unknown variable "\${${name}}" in "${text}"`);
    }
    if (!stringifiable(value)) {
      throw new Error(
        `Cannot interpolate "\${${name}}" in "${text}": its value is a heredoc, not text`,
      );
    }
    return String(value);
  });

const resolveArg = (arg: Value, scope: Scope): Value => {
  if (typeof arg !== "string") return arg;

  const bare = BARE_VARIABLE_PATTERN.exec(arg);
  if (bare) {
    const value = scope.get(bare[1]!);
    if (value === undefined) {
      throw new Error(`Unknown variable "$${bare[1]}"`);
    }
    return value;
  }

  return TEMPLATE_PATTERN.test(arg) ? interpolate(arg, scope) : arg;
};

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
      if (sibling.args.length !== 2 || typeof sibling.args[0] !== "string") {
        throw new Error(
          `"set" expects a variable name and one value, got: ${JSON.stringify(sibling.args)}`,
        );
      }
      const [name, value] = sibling.args as [string, Value];
      blockScope.set(name, resolveArg(value, blockScope));
      continue;
    }

    resolved.push(transform(sibling, blockScope));
  }

  return resolved;
};

const transform = (directive: Directive, enclosingScope: Scope): Directive =>
  new Directive(
    directive.name,
    directive.args.map((arg) => resolveArg(arg, enclosingScope)),
    transformSiblings(directive.children, new Scope(enclosingScope)),
  );

/**
 * Resolves `set`/`$name`/`${name}` variables over an already-parsed
 * `Directive` tree, with `set` **block-scoped**: a `set` inside a block
 * shadows one of the same name from an enclosing block for the rest of
 * that inner block, then reverts once the block ends (see
 * `docs/concepts/references.md`'s "Decided: `set` is block-scoped").
 *
 * This is a standalone tree transform, not a `DonPlugin` (compare
 * `variablesPlugin` in `./variables-plugin.js`) — `DonPlugin#onDirective`
 * only fires once per directive, pre-order, with no signal for when a
 * block's children are done being visited, so it can't express a shadow
 * being restored after the block that introduced it closes. This
 * function owns its own recursion instead, so it can push a fresh scope
 * before descending into a block and let it fall out of scope (in the
 * literal, JS-closure sense) once that block's children are done:
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
