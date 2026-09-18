import type { DonPlugin, PluginDirectiveNode } from "../plugin.js";

type Value = number | string | boolean;

interface ScopedVariablesContext {
  scopes: Map<string, Value>[];
}

const BARE_VARIABLE_PATTERN = /^\$([A-Za-z_][A-Za-z0-9_]*)$/;
const INTERPOLATION_PATTERN = /\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g;

const lookup = (
  scopes: Map<string, Value>[],
  name: string,
): Value | undefined => {
  for (let i = scopes.length - 1; i >= 0; i--) {
    const scope = scopes[i]!;
    if (scope.has(name)) return scope.get(name);
  }
  return undefined;
};

const resolveArg = (
  arg: PluginDirectiveNode["args"][number],
  scopes: Map<string, Value>[],
): PluginDirectiveNode["args"][number] => {
  if (typeof arg !== "string") return arg;

  // A whole argument written as `$name` resolves to the variable's own
  // value and type (a number stays a number) — not just a string
  // substitution.
  const bareMatch = BARE_VARIABLE_PATTERN.exec(arg);
  if (bareMatch) {
    const value = lookup(scopes, bareMatch[1]!);
    return value === undefined ? arg : value;
  }

  // `${name}` embedded anywhere inside a larger string interpolates just
  // that piece, always as text — the rest of the string around it stays
  // untouched. A reference to an undefined variable is left as-is.
  if (!INTERPOLATION_PATTERN.test(arg)) return arg;
  INTERPOLATION_PATTERN.lastIndex = 0;
  return arg.replace(INTERPOLATION_PATTERN, (match, name: string) => {
    const value = lookup(scopes, name);
    return value === undefined ? match : String(value);
  });
};

export interface ScopedVariablesPluginOptions {
  /**
   * Variables seeded into the **root** scope before parsing starts — as
   * if each entry were its own `set <name> <value>` at the very top of
   * the document, before anything else. A `set` anywhere in the document
   * (root or nested) can still shadow one of these within its own block,
   * the same as shadowing any other outer-scope variable; it never
   * mutates what's passed in here. Defaults to no variables (an empty
   * root scope), matching `scopedVariablesPlugin`.
   */
  variables?: Record<string, Value> | Map<string, Value>;
}

/**
 * A `DonPlugin` factory implementing `set <name> <value>` and two forms of
 * variable reference — `$name` (whole-argument, type-preserving) and
 * `${name}` (interpolated inside a larger string) — with **block scope**:
 * each `{ ... }` block gets its own scope, nested inside its enclosing
 * one. A `set` inside a block only defines the variable for that block
 * (and whatever it encloses) — it never leaks back out once the block
 * ends, even when it shadows a variable of the same name from an outer
 * scope:
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
 * parses (with `DON.parse(text, { plugins: [createScopedVariablesPlugin()] })`)
 * to two top-level directives — `foo` (args `[33]`, from the outer scope)
 * and `tar` (whose own child `foo` resolves to `[55]`, from the scope
 * `tar`'s block introduced). Once `tar`'s block ends, that block's `foo`
 * is gone again — a sibling directive after `tar` referencing `$foo`
 * would still see `33`.
 *
 * String interpolation works the same way, resolving against whichever
 * scope is active where the string appears:
 *
 * ```don
 * set project FOO
 *
 * container "${project}-container-1" {}
 * ```
 *
 * parses to `Directive{name:"container", args:["FOO-container-1"]}`.
 *
 * `createScopedVariablesPlugin({ variables })` seeds the **root** scope
 * with variables the document itself never `set` — environment-style
 * defaults a caller supplies from outside the document:
 *
 * ```ts
 * const plugin = createScopedVariablesPlugin({ variables: { env: "prod" } });
 * const result = DON.parse('stage $env', { plugins: [plugin] });
 * // ? result.args = ["prod"]
 * ```
 *
 * A document-level `set env staging` still shadows it within whichever
 * block sets it, exactly as it would shadow any other outer variable.
 *
 * Scoping is built on `onEnterScope`/`onExitScope` (see `DonPlugin`):
 * `initContext` seeds the root scope (from `options.variables`, if any),
 * `onEnterScope` pushes a fresh empty one for every block, `onExitScope`
 * pops it back off once the block's children are all visited, and `set`
 * always writes into the scope on top of the stack at the time it runs.
 */
export const createScopedVariablesPlugin = (
  options: ScopedVariablesPluginOptions = {},
): DonPlugin<ScopedVariablesContext> => {
  const { variables } = options;

  return {
    name: "scoped-variables",

    initContext: () => ({
      scopes: [
        new Map(
          variables instanceof Map
            ? variables
            : Object.entries(variables ?? {}),
        ),
      ],
    }),

    onDirective(node, ctx) {
      const args = node.args.map((arg) =>
        resolveArg(arg, ctx.scopes),
      ) as PluginDirectiveNode["args"];

      if (node.name === "set") {
        const [varname, value] = args;
        if (typeof varname === "string" && value !== undefined) {
          ctx.scopes[ctx.scopes.length - 1]!.set(varname, value as Value);
        }
        return null;
      }

      return { name: node.name, args };
    },

    onEnterScope(_node, ctx) {
      ctx.scopes.push(new Map());
    },

    onExitScope(_node, ctx) {
      ctx.scopes.pop();
    },
  };
};

/**
 * `createScopedVariablesPlugin()` with no root variables seeded — the
 * common case, kept as a ready-to-use plugin instance so callers who
 * don't need `options.variables` can pass it straight to
 * `DON.parse(text, { plugins: [scopedVariablesPlugin] })` without calling
 * the factory themselves.
 */
export const scopedVariablesPlugin = createScopedVariablesPlugin();
