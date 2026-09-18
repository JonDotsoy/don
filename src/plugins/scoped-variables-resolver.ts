import { Directive } from "../don.js";
import { ROOT_DIRECTIVE_NAME, wrapAsRoot } from "../directive-json.js";
import {
  bindSet,
  resolveScopedArg,
  type ScopeReader,
  type ScopedValue,
  type ScopeWriter,
} from "./scope.js";

// Keyed by the *source* directive that owns a block — i.e. whichever
// directive's direct children may include `set` bindings for that
// block. Populated lazily, only once a `set` inside that block is
// actually seen (`writerAt` below), rather than eagerly for every
// directive the way a parameter-passed `Scope` chain would need to.
const scopesByDirective = new WeakMap<Directive, Map<string, ScopedValue>>();

// getValue(directive, name) ?? getValue(directive.parent, name) ?? … —
// this directive's own bindings first, then its enclosing directive's,
// walking outward via `Directive#parent` until a `set` for `name` is
// found or the root (`parent === undefined`) is reached.
const getValue = (
  directive: Directive | undefined,
  name: string,
): ScopedValue | undefined => {
  if (!directive) return undefined;
  const bindings = scopesByDirective.get(directive);
  if (bindings?.has(name)) return bindings.get(name);
  return getValue(directive.parent, name);
};

const readerAt = (directive: Directive | undefined): ScopeReader => ({
  get: (name) => getValue(directive, name),
});

// `owner` is the directive whose block this scope belongs to (i.e. the
// directive that owns the `children` a `set` sits in) — reads and
// writes both go through the same `WeakMap` entry for `owner`, created
// on the first `set` bound into it.
const writerAt = (owner: Directive): ScopeWriter => ({
  get: (name) => getValue(owner, name),
  set: (name, value) => {
    let bindings = scopesByDirective.get(owner);
    if (!bindings) {
      bindings = new Map();
      scopesByDirective.set(owner, bindings);
    }
    bindings.set(name, value);
  },
});

// Resolves one block's worth of siblings, all owned by `owner`: a
// `set` binds into `owner`'s own scope entry (and is dropped),
// everything else is resolved and recurses into its own block, owned
// by itself.
const resolveChildren = (
  owner: Directive,
  children: readonly Directive[],
): Directive[] => {
  const writer = writerAt(owner);
  const resolved: Directive[] = [];

  for (const child of children) {
    if (child.name === "set") {
      bindSet(child.args, writer);
      continue;
    }

    resolved.push(buildResolved(child));
  }

  return resolved;
};

const buildResolved = (directive: Directive): Directive =>
  new Directive(
    directive.name,
    directive.args.map((arg) =>
      resolveScopedArg(arg, readerAt(directive.parent)),
    ),
    resolveChildren(directive, directive.children),
  );

/**
 * Resolves `set`/`$name`/`${name}` variables over an already-parsed
 * `Directive` tree, with `set` **block-scoped**: a `set` inside a block
 * shadows one of the same name from an enclosing block for the rest of
 * that inner block, then reverts once the block ends (see
 * `docs/concepts/references.md`'s "Decided: `set` is block-scoped").
 *
 * Scopes are kept in a module-level `WeakMap<Directive, Map<string,
 * ScopedValue>>`, keyed by the *source* directive that owns each block
 * — populated lazily as `set` directives are encountered, read back via
 * `Directive#parent` (`getValue` above), rather than as `Scope` objects
 * threaded through the recursion as a parameter (compare
 * `scopedVariablesPlugin`'s `ctx`, which keeps a `Scope` stack instead,
 * since it has no `Directive` tree yet to key a `WeakMap` off — see
 * `./scoped-variables-plugin.js`). Either way, this is a standalone
 * tree transform, not a `DonPlugin` passed to `DON.parse()` itself —
 * useful when the tree didn't come from `DON.parse()` at all (e.g. one
 * built by `DirectiveJSONDecoder`, or assembled by hand). If you're
 * resolving variables in a document you're about to parse with
 * `DON.parse()` itself, prefer `scopedVariablesPlugin` instead — same
 * rules, wired into `DON.parse(text, { plugins: [scopedVariablesPlugin]
 * })` directly:
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
    return buildResolved(root);
  }

  return wrapAsRoot(resolveChildren(root, root.children));
};
