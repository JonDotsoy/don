import { DON } from "../../don.js";
import type { DonPlugin, PluginDirectiveNode } from "../../plugin.js";

/** A directive-name → constructor map: `{ app: App, server: Server }`. */
export type ClassMap = Record<string, new (...args: any[]) => any>;

interface ResolvedChild {
  readonly name: string | symbol;
  readonly value: unknown;
}

/**
 * `ClassResolverContext#stack`'s shape: one frame per currently-open
 * `{ ... }` block (plus the root frame, always `stack[0]`), each holding
 * the already-resolved `{ name, value }` pairs of the children seen so
 * far in that block. See `createClassResolverPlugin` for how frames are
 * pushed/popped.
 */
export interface ClassResolverContext {
  stack: ResolvedChild[][];
}

const groupByName = (
  children: readonly ResolvedChild[],
): Map<string | symbol, unknown[]> => {
  const grouped = new Map<string | symbol, unknown[]>();
  for (const { name, value } of children) {
    const values = grouped.get(name);
    if (values) values.push(value);
    else grouped.set(name, [value]);
  }
  return grouped;
};

/**
 * Builds the value a single directive resolves to, from its own
 * `args`/`name` and its already-resolved children (bottom-up: every
 * child has already gone through this same function by the time its
 * parent does — see `createClassResolverPlugin`'s `onExitScope`).
 *
 * - A directive whose `name` is a key in `classes` becomes
 *   `new classes[name](...args)`, with each child assigned onto it as a
 *   same-named property: one child of that name → the resolved value
 *   itself, two or more (a repeated directive) → an array of them, in
 *   document order.
 * - A directive **not** in `classes`, with no children, unwraps to its
 *   own args — a single arg becomes that scalar value (`host "x"` →
 *   `"x"`), zero or several args stay an array (`route GET /x` →
 *   `["GET", "/x"]`).
 * - A directive not in `classes` but **with** children (a plain
 *   `{ ... }` block with no registered class, e.g. `feature-flags`)
 *   becomes a plain object of its own children, grouped the same way a
 *   class instance's properties are.
 */
const buildValue = (
  node: PluginDirectiveNode,
  children: readonly ResolvedChild[],
  classes: ClassMap,
): unknown => {
  const Ctor = typeof node.name === "string" ? classes[node.name] : undefined;
  const grouped = groupByName(children);

  if (Ctor) {
    const instance = new Ctor(...node.args);
    for (const [name, values] of grouped) {
      (instance as Record<string | symbol, unknown>)[name] =
        values.length === 1 ? values[0] : values;
    }
    return instance;
  }

  if (children.length === 0) {
    return node.args.length === 1 ? node.args[0] : [...node.args];
  }

  const plain: Record<string | symbol, unknown> = {};
  for (const [name, values] of grouped) {
    plain[name] = values.length === 1 ? values[0] : values;
  }
  return plain;
};

/**
 * A third demo `DonPlugin`: resolves a parsed document into plain class
 * instances instead of a `Directive` tree, by matching each directive's
 * `name` against a caller-supplied `classes` map:
 *
 * ```ts
 * class App {
 *   constructor(public name: string) {}
 *   server!: Server;
 * }
 * class Server {
 *   host!: string;
 *   port!: number;
 * }
 * ```
 *
 * ```don
 * app "foo" {
 *   server {
 *     host "0.0.0.0"
 *     port 8080
 *   }
 * }
 * ```
 *
 * `app` and `server` are both registered class names, so each becomes
 * `new App(...)`/`new Server(...)` (constructor args come from the
 * directive's own positional args — `App` gets `"foo"`, `Server` gets
 * none); `host` and `port` aren't registered, so they unwrap to their
 * own single arg (`"0.0.0.0"`, `8080`) and get assigned onto the
 * `Server` instance as same-named properties. The result: `app instanceof
 * App`, `app.server instanceof Server`, `app.server.host === "0.0.0.0"`.
 *
 * `DON.parse()` itself always returns a `Directive` — a plugin can only
 * transform the tree it's built from (see `DonPlugin`), never change
 * what `DON.parse()` hands back. So this plugin builds its class
 * instances into its own `ctx` as a side effect while parsing runs
 * (`onEnterScope` pushes a fresh frame per block, `onExitScope` pops it,
 * builds that directive's value from `buildValue`, and pushes the
 * result onto its parent's frame — a bottom-up build mirroring the
 * document's own nesting), and you read the finished root back out of
 * `ctx` afterwards — either through `resolveClasses(ctx)`, or in one
 * step through `parseAsClasses` below.
 */
export const createClassResolverPlugin = (
  classes: ClassMap,
): DonPlugin<ClassResolverContext> => ({
  name: "class-resolver",

  initContext: () => ({ stack: [[]] }),

  onEnterScope(_node, ctx) {
    ctx.stack.push([]);
  },

  onExitScope(node, ctx) {
    const children = ctx.stack.pop() ?? [];
    const value = buildValue(node, children, classes);
    ctx.stack.at(-1)!.push({ name: node.name, value });
  },
});

/**
 * Reads the class instance a `createClassResolverPlugin`'s `ctx` built
 * for the document's root directive, once `DON.parse()` has returned.
 * Throws if the document had no directives at all (nothing to resolve).
 */
export const resolveClasses = <T = unknown>(ctx: ClassResolverContext): T => {
  const [root] = ctx.stack[0]!;
  if (!root) {
    throw new Error(
      "classResolverPlugin: nothing to resolve — the document had no directives",
    );
  }
  return root.value as T;
};

/**
 * `DON.parse(text, { plugins: [...] })` in one call: wires a fresh
 * `createClassResolverPlugin(classes)` (plus any `extraPlugins`, run
 * before it, e.g. `variablesPlugin`) and hands back the resolved root
 * instance directly, instead of the `Directive` tree `DON.parse()`
 * itself always returns:
 *
 * ```ts
 * const app = parseAsClasses<App>(text, { app: App, server: Server });
 * // app instanceof App, app.server instanceof Server
 * ```
 */
export const parseAsClasses = <T = unknown>(
  text: string,
  classes: ClassMap,
  extraPlugins: DonPlugin[] = [],
): T => {
  const ctx: ClassResolverContext = { stack: [[]] };
  const classResolverPlugin = {
    ...createClassResolverPlugin(classes),
    initContext: () => ctx,
  };

  DON.parse(text, { plugins: [...extraPlugins, classResolverPlugin] });

  return resolveClasses<T>(ctx);
};
