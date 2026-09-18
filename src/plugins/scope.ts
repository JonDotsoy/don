import type { HeredocValue } from "../don.js";

export type ScopedValue = number | string | boolean | HeredocValue;

const BARE_VARIABLE_PATTERN = /^\$([A-Za-z_][A-Za-z0-9_-]*)$/;
const TEMPLATE_PATTERN = /(\\)?\$\{([A-Za-z_][A-Za-z0-9_-]*)\}/g;

/** Anything `resolveScopedArg`/`bindSet` can read a bound name back from. */
export interface ScopeReader {
  get(name: string): ScopedValue | undefined;
}

/** A `ScopeReader` `bindSet` can also bind a new name into. */
export interface ScopeWriter extends ScopeReader {
  set(name: string, value: ScopedValue): void;
}

/**
 * A `set`-bound name lookup, chained to the block it was declared in.
 * `get` walks outward — this scope first, then its parent, and so on —
 * so a `set` in a nested block shadows one of the same name from an
 * enclosing block only for as long as that nested block lasts. Used by
 * `scopedVariablesPlugin` (a `DonPlugin`, scoped by an `onDirective`/
 * `afterChildren` push/pop, since it has no `Directive` tree of its own
 * to key a lookup off yet) — see `docs/plugins/scoped-variables.md`.
 *
 * `resolveScopedVariables` (a standalone post-parse resolver) instead
 * keys scopes by the already-built source `Directive` a block belongs
 * to, walking `Directive#parent` to look outward — see that module for
 * its own `ScopeWriter`.
 */
export class Scope implements ScopeWriter {
  private readonly bindings = new Map<string, ScopedValue>();

  constructor(private readonly parent?: Scope) {}

  set(name: string, value: ScopedValue): void {
    this.bindings.set(name, value);
  }

  get(name: string): ScopedValue | undefined {
    if (this.bindings.has(name)) return this.bindings.get(name);
    return this.parent?.get(name);
  }
}

const stringifiable = (
  value: ScopedValue,
): value is number | string | boolean => typeof value !== "object";

const interpolate = (text: string, scope: ScopeReader): string =>
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

/** Resolves a single argument against `scope`. */
export const resolveScopedArg = (
  arg: ScopedValue,
  scope: ScopeReader,
): ScopedValue => {
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

/**
 * Validates and binds a `set <name> <value>` directive's args into
 * `scope`, resolving `value` against `scope` first (so `set b $a`
 * chains). Throws for anything other than exactly one name and one
 * value argument — the extended `set` forms sketched in
 * `docs/concepts/references.md` aren't implemented here.
 */
export const bindSet = (
  args: readonly ScopedValue[],
  scope: ScopeWriter,
): void => {
  if (args.length !== 2 || typeof args[0] !== "string") {
    throw new Error(
      `"set" expects a variable name and one value, got: ${JSON.stringify(args)}`,
    );
  }
  const [name, value] = args as [string, ScopedValue];
  scope.set(name, resolveScopedArg(value, scope));
};
