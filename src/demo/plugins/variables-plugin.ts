import type { DonPlugin, PluginDirectiveNode } from "../../plugin.js";

const VARIABLE_PATTERN = /^\$([A-Za-z_][A-Za-z0-9_]*)$/;

/**
 * A first demo `DonPlugin`: a `set <name> <value>` directive stores
 * `<value>` under `<name>` (dropped from the resulting tree — it's a
 * pragma, not data), and any later argument written as `$<name>` resolves
 * to that value:
 *
 * ```don
 * set foo 33
 *
 * tar biz lol {
 *   bob $foo
 * }
 * ```
 *
 * parses (with `DON.parse(text, { plugins: [variablesPlugin] })`) to
 * `Directive{name:"tar", args:["biz","lol"], children:[
 *   Directive{name:"bob", args:["33"]}
 * ]}` — `set` is gone, and `bob`'s `$foo` became `"33"`, since `set foo
 * 33` ran before `bob $foo` (directives are visited in document order —
 * see `DonPlugin#onDirective`). Values live in `ctx` as strings, so a
 * `set`'s own value is stringified going in. To read a variable back
 * after parsing, override this plugin's `initContext()` to return a
 * `Map<string, string>` you keep a reference to yourself (e.g.
 * `{ ...variablesPlugin, initContext: () => ctx }`).
 */
export const variablesPlugin: DonPlugin<Map<string, string>> = {
  name: "variables",

  // A plugin that defines no `initContext` gets `ctx: undefined` — this
  // one needs `ctx.get`/`set`, so it builds its own `Map`.
  initContext: () => new Map(),

  onDirective(node, ctx) {
    const args = node.args.map((arg) => {
      if (typeof arg !== "string") return arg;
      const match = VARIABLE_PATTERN.exec(arg);
      return match ? ctx.get(match[1]!) : arg;
    }) as PluginDirectiveNode["args"];

    if (node.name === "set") {
      const [varname, value] = args;
      if (typeof varname === "string") ctx.set(varname, String(value));
      return null;
    }

    return { name: node.name, args };
  },
};
