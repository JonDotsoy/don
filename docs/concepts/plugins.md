---
title: Plugins
description: How DonPlugin hooks into DON.parse()'s pipeline to add language features — set/onDirective/initContext, reading tokens, and a full variablesPlugin walkthrough.
lang: en
---

# Plugins

> Implementation: [`src/plugin.ts`](../../src/plugin.ts), wired into
> [`src/don.ts`](../../src/don.ts)

## What a plugin is

A **plugin** (`DonPlugin`) is a `DON.parse(text, { plugins })` extension
that hooks into the parser's own pipeline to add new language features —
variables, macros, pragmas, syntax-level validation, argument
transforms — without touching `donly`'s lexer or syntax parser at all.
DON itself defines nothing beyond directives, arguments, and blocks (see
the [README](../../README.md)); plugins are how a document gains anything
resembling behavior on top of that grammar, like the `set`/`$foo`
variable substitution `variablesPlugin` demonstrates below.

`DON.parse()`'s pipeline, and where a plugin sits in it:

```
text
  → LexerParser        (raw source → flat Token list)
  → SyntaxParser        (tokens → DirectiveNode tree, unresolved)
  → for each DirectiveNode, depth-first pre-order:
      → plugin.onDirective(node, ctx)   ← plugins run here
      → build the Directive (unless dropped)
  → Directive tree (what DON.parse() returns)
```

A plugin never sees `Token`s or `DirectiveNode`s directly — by the time
`onDirective` runs, each directive's name and arguments are already
resolved to their JS values (`node.args` is `readonly (number | string |
boolean | HeredocValue)[]`, the same value type a built `Directive`'s
`args` has). `node` itself is never mutated in place — a plugin that
wants to change it returns a new `PluginDirectiveNode` instead (see
`onDirective` below). What a plugin gets to do is inspect that resolved
shape, hand back a rewritten one, and decide whether the directive
survives into the final tree at all.

"Depth-first pre-order" means: a directive is visited before its own
children, and an earlier sibling before a later one — the same order the
document reads in, top to bottom. That's what lets a plugin make an
earlier directive affect a later one (`set foo 33` before `bob $foo`,
however deeply `bob` is nested), by stashing state in `ctx` as it goes.

## Creating a plugin

A plugin is a plain object implementing `DonPlugin<TContext>`:

```ts
import type { DonPlugin } from "donly";

const myPlugin: DonPlugin = {
  name: "my-plugin",
  onDirective(node, ctx) {
    // ...
  },
};
```

Three properties make up the interface:

### `name: string`

An identifier for the plugin — informational only (`donly` never looks
it up or dispatches on it), useful for logging or for a plugin registry
of your own to tell plugins apart.

### `initContext?(): TContext`

Builds this plugin's own `ctx`, called **once per `DON.parse()` call**,
before any directive is visited. `TContext` is entirely up to the
plugin — there's no required shape for it, since it's only ever handed
back to that same plugin's own `onDirective`: a plain object, an array, a
class instance, anything.

If a plugin defines no `initContext`, `DON.parse()` never builds anything
on its behalf — `ctx` is simply `undefined` in every `onDirective` call
for that plugin. `initContext` only needs defining once a plugin actually
has state to carry across directives; a plugin that only reads/rewrites
`node.args` in isolation (like `upper` above) can skip it entirely. A
plain `new Map()` is a common `initContext` body for a plugin that just
needs flat named state, as `variablesPlugin` does below.

Whatever `initContext` returns is **never shared with another plugin's
`ctx`** — so two plugins can't collide on the same state, whether or not
either defines `initContext` at all. See
[Plugins](../../README.md#plugins) in the README for the isolation rules
in more detail, including how to read a plugin's `ctx` back out after
parsing (keep the reference `initContext` returns yourself — there's no
separate lookup API).

### `onDirective?(node: PluginDirectiveNode, ctx: TContext): PluginDirectiveNode | null | void`

Called for every directive node, depth-first pre-order, before it's
built into a `Directive`. `node` is a readonly `PluginDirectiveNode`:

```ts
interface PluginDirectiveNode {
  readonly name: string | symbol;
  readonly args: readonly (number | string | boolean | HeredocValue)[];
  readonly children?: readonly PluginDirectiveNode[];
}
```

**never mutated in place** — by design, so a plugin can't accidentally
step on a `node` another plugin (or `donly` itself) is still holding a
reference to. Instead, `onDirective` can:

- **Read** `node.name`/`node.args` to decide what to do.
- **Return a new `PluginDirectiveNode`** (e.g.
  `{ name: node.name, args: node.args.map(...) }`) to change what gets
  built into the resulting `Directive`.
- **Set `children`** on that returned node to replace the directive's
  children entirely with a synthetic subtree, instead of whatever
  children the source document had at that point — `createResourcesPlugin`
  below expands a resource reference into one this way. Each entry is
  itself a `PluginDirectiveNode`, built directly into `Directive`s
  without going through the lexer/syntax parser or any plugin again.
  Omitting `children` (as `variablesPlugin` does) keeps the source's own
  children, parsed and run through the plugin pipeline as usual.
- **Return `null`** to drop this directive — and its whole subtree —
  from the resulting tree entirely. This is how a pragma-style directive
  that only has a side effect on `ctx` (like `set` in the example below)
  disappears from the parsed output.
- **Return nothing (`void`)** to leave `node` exactly as it was passed
  in — the common case for a plugin that only reads `node` or only
  touches `ctx`.

When more than one plugin is passed to `DON.parse()`, every plugin's
`onDirective` runs on the _same_ directive, in `plugins` array order,
before the parser moves on — each with its own `ctx`. Whatever one
plugin returns (a replacement node, or nothing) becomes the `node` the
next plugin in the list receives, so a later plugin already sees an
earlier plugin's rewrite.

## Block scope: `onEnterScope`/`onExitScope`

`onDirective` alone is enough for state that only ever grows (like
`variablesPlugin`'s flat `Map` above, where a later `set foo` in any block
overwrites the same global `foo`). It isn't enough for state that needs to
come back off again once a `{ ... }` block ends — e.g. a `set` inside a
block shadowing an outer variable of the same name, without leaking the
shadowed value out past that block's closing `}`.

Two more (both optional) round out `DonPlugin` for that:

```ts
onEnterScope?(node: PluginDirectiveNode, ctx: TContext): void;
onExitScope?(node: PluginDirectiveNode, ctx: TContext): void;
```

`onEnterScope` runs right after `onDirective` for a directive, right
before that directive's own (source, not plugin-synthesized) children are
visited; `onExitScope` runs right after all of them are done — one
`onEnterScope`/`onExitScope` pair per directive, however many children it
has (zero included). Since visiting is depth-first pre-order and these two
bracket exactly one nesting level each, a plugin that pushes its own scope
frame onto a stack in `onEnterScope` and pops it in `onExitScope` gets a
scope chain that mirrors the document's own block structure — see
`scopedVariablesPlugin` below.

## Reading tokens

`onDirective` only ever sees resolved values, not the original `Token`s —
those exist earlier in the pipeline (`LexerParser`/`SyntaxParser`) and
later, attached to the finished `Directive` tree. If a plugin (or any
other code) needs the exact source text a directive was written with —
line/column spans, the raw quoted-or-not form of an argument, etc. — read
it off a `Directive` _after_ `DON.parse()` returns, via
`Directive.tokensByDirective()`:

`tokensByDirective(directive)` returns the directive's own `Token`s —
its name first, then each argument, in source order — or `undefined` for
a `Directive` not produced by `DON.parse()` (e.g. one built by hand).
Reading a single argument's token works the same way — index into the
rest of that array for the one you want:

```ts
import { DON, Directive } from "donly";

const root = DON.parse('host "localhost" 8080');

const tokens = Directive.tokensByDirective(root);
const [nameToken, ...argTokens] = tokens!;

const name = nameToken.raw();
// ? const name = "host"
const firstArg = argTokens[0]!.raw();
// ? const firstArg = "\"localhost\""
const secondArg = argTokens[1]!.raw();
// ? const secondArg = "8080"
```

`token.raw()` is the exact source slice (quotes included, for a quoted
string); `token.text()` is the decoded value instead (`"localhost"`
without the surrounding quotes); `token.toJS()` is the same JS-value
conversion `DON.parse()` uses to build `args` (`"localhost"` as a string,
`8080` as a number); `token.span` carries the byte offset and
line/column range. See [Lexer
(`LexerParser`)](../../README.md#lexer-lexerparser) in the README for the
full `Token` API.

## Example 1: `variablesPlugin`

`donly/demo/plugins/variables` ([`src/demo/plugins/variables-plugin.ts`](../../src/demo/plugins/variables-plugin.ts))
is a complete, minimal plugin built from exactly the three pieces above.
It implements a `set <name> <value>` pragma and `$<name>` variable
references:

```ts
import type { DonPlugin, PluginDirectiveNode } from "donly";

const VARIABLE_PATTERN = /^\$([A-Za-z_][A-Za-z0-9_]*)$/;

export const variablesPlugin: DonPlugin<Map<string, string>> = {
  name: "variables",

  // ctx would otherwise be `undefined` — this plugin needs `get`/`set`,
  // so it builds its own `Map`.
  initContext: () => new Map(),

  onDirective(node, ctx) {
    // Resolve every `$name` argument to whatever `ctx` has stored for
    // `name` — `undefined` if `set name ...` hasn't run yet. Never
    // mutates `node.args` — builds a new array instead.
    const args = node.args.map((arg) => {
      if (typeof arg !== "string") return arg;
      const match = VARIABLE_PATTERN.exec(arg);
      return match ? ctx.get(match[1]!) : arg;
    }) as PluginDirectiveNode["args"];

    // `set <name> <value>` stores the (already `$`-resolved) value,
    // stringified since `ctx` is a `Map<string, string>`, and is
    // dropped — it's a pragma, not data the caller should see.
    if (node.name === "set") {
      const [varname, value] = args;
      if (typeof varname === "string") ctx.set(varname, String(value));
      return null;
    }

    return { name: node.name, args };
  },
};
```

Every `DON.parse()` call using this plugin gets its own fresh `Map()` for
`ctx`, built from `initContext` right before parsing starts.

Given:

```don
set foo 33

tar biz lol {
  bob $foo
}
```

```ts
import { DON } from "donly";
import { variablesPlugin } from "donly/demo/plugins/variables";

const result = DON.parse(
  `
set foo 33

tar biz lol {
  bob $foo
}
`,
  { plugins: [variablesPlugin] },
);
// ? const result = Directive {
//   name: "tar",
//   args: [ "biz", "lol" ],
//   children: [
//     Directive {
//       name: "bob",
//       args: [ "33" ],
//       children: [],
//     }
//   ],
// }
```

Walking through what happened, in visit order:

1. `set foo 33` — `node.args` is `["foo", 33]` (no `$`-prefixed strings to
   resolve), `node.name === "set"` stores `ctx.set("foo", "33")`
   (stringified), and `onDirective` returns `null` — `set` never reaches
   the output tree.
2. `tar biz lol { ... }` — no `$` arguments, nothing to resolve; not
   named `set`, so `onDirective` returns a new node with the same
   `name`/`args`, and its children get visited next.
3. `bob $foo` — `node.args` is `["$foo"]`; the pattern matches, and
   `ctx.get("foo")` (set in step 1) resolves it to `"33"` in the
   returned node's `args`.

Since only one top-level directive (`tar`) survives — `set` was
dropped — `DON.parse()` returns it unwrapped, per its usual
single-top-level-directive rule (see
[Usage](../../README.md#usage) in the README).

To read `foo` back after parsing, override the plugin's `initContext` to
return a `Map<string, string>` you keep a reference to yourself (see
[Plugins](../../README.md#plugins) in the README for the full pattern,
including a `ctx` shaped as something other than a `Map`):

```ts
import { DON } from "donly";
import { variablesPlugin } from "donly/demo/plugins/variables";

const ctx = new Map<string, string>();

DON.parse("set foo 33", {
  plugins: [{ ...variablesPlugin, initContext: () => ctx }],
});

const foo = ctx.get("foo");
// ? const foo = "33"
```

## Example 2: `createResourcesPlugin`

`donly/demo/plugins/resources` ([`src/demo/plugins/resources-plugin.ts`](../../src/demo/plugins/resources-plugin.ts))
shows the other half of what a plugin can do: instead of resolving a
small inline reference like `$foo`, it expands a `resource sqlite
<file-url>` directive into the data that file points at, using
`PluginDirectiveNode#children` to attach a whole synthetic subtree the
source document never wrote out. A real version would actually open the
`.sqlite` file (page count for size, `sqlite_master`/`PRAGMA table_info`
for tables and columns); this demo only simulates that read
(`inspectSqliteFile` in the source always "discovers" the same fixed
schema), since the point is the plugin's shape, not a real SQLite reader:

```ts
import { resolve as resolvePath } from "node:path";
import type { DonPlugin } from "donly";

export const createResourcesPlugin = (
  options: { cwd?: string } = {},
): DonPlugin => {
  const cwd = options.cwd ?? process.cwd();

  return {
    name: "resources",

    onDirective(node) {
      if (node.name !== "resource") return;

      const [type, url] = node.args;
      if (typeof type !== "string" || typeof url !== "string") return;

      const match = /^file:\/\/(.+)$/.exec(url);
      if (!match || type !== "sqlite") return;

      const absolutePath = resolvePath(cwd, match[1]!);
      // const schema = inspectSqliteFile(absolutePath); (simulated)

      return {
        name: node.name,
        args: [type, `file://${absolutePath}`],
        children: [
          { name: "size", args: [34, "megabites"] },
          {
            name: "table",
            args: ["user"],
            children: [
              { name: "rows", args: [350] },
              {
                name: "columns",
                args: [],
                children: [
                  { name: "user_id", args: ["TEXT", "primarykey"] },
                  { name: "name", args: ["TEXT"] },
                  { name: "role", args: ["TEXT"] },
                ],
              },
            ],
          },
          // ...a "product" table node, shaped the same way.
        ],
      };
    },
  };
};
```

Unlike `variablesPlugin` (a plain object), `createResourcesPlugin` is a
**factory function** returning a `DonPlugin` — because resolving a
relative `file://` path needs a base directory, and always resolving
against `process.cwd()` would make the result depend on wherever the
process happens to run from. `createResourcesPlugin({ cwd })` fixes that
directory instead, which matters for reproducible output (tests, docs
examples like this one, ...).

Given:

```don
resource sqlite file://./db.sqlite
```

```ts
import { DON } from "donly";
import { createResourcesPlugin } from "donly/demo/plugins/resources";

const result = DON.parse("resource sqlite file://./db.sqlite", {
  plugins: [createResourcesPlugin({ cwd: "/srv/app" })],
});
// ? const result = Directive {
//   name: "resource",
//   args: [ "sqlite", "file:///srv/app/db.sqlite" ],
//   children: [
//     Directive {
//       name: "size",
//       args: [ 34, "megabites" ],
//       children: [],
//     }, Directive {
//       name: "table",
//       args: [ "user" ],
//       children: [
//         Directive {
//           name: "rows",
//           args: [ 350 ],
//           children: [],
//         }, Directive {
//           name: "columns",
//           args: [],
//           children: [
//             Directive {
//               name: "user_id",
//               args: [ "TEXT", "primarykey" ],
//               children: [],
//             }, Directive {
//               name: "name",
//               args: [ "TEXT" ],
//               children: [],
//             }, Directive {
//               name: "role",
//               args: [ "TEXT" ],
//               children: [],
//             }
//           ],
//         }
//       ],
//     }, Directive {
//       name: "table",
//       args: [ "product" ],
//       children: [
//         Directive {
//           name: "rows",
//           args: [ 7000 ],
//           children: [],
//         }, Directive {
//           name: "columns",
//           args: [],
//           children: [
//             Directive {
//               name: "product_id",
//               args: [ "TEXT", "primarykey" ],
//               children: [],
//             }, Directive {
//               name: "name",
//               args: [ "TEXT" ],
//               children: [],
//             }, Directive {
//               name: "price",
//               args: [ "INTEGER" ],
//               children: [],
//             }
//           ],
//         }
//       ],
//     }
//   ],
// }
```

The `./db.sqlite` relative path in the source became the absolute
`/srv/app/db.sqlite` in `result.args`, and `resource`'s own (empty)
children were entirely replaced by the synthetic `size`/`table`/`columns`
subtree `onDirective` returned — none of it went through `LexerParser`/
`SyntaxParser`, and `Directive.tokensByDirective()` on any of these
synthetic `Directive`s returns `undefined`, the same as for a `Directive`
built by hand. A `resource` directive naming any other type (or one
without a `file://` URL argument) comes back untouched, since
`onDirective` returns nothing (`void`) for it.

## Example 3: `scopedVariablesPlugin`

`donly/demo/plugins/scoped-variables`
([`src/demo/plugins/scoped-variables-plugin.ts`](../../src/demo/plugins/scoped-variables-plugin.ts))
builds on `variablesPlugin`'s idea with the two features `onEnterScope`/
`onExitScope` exist for: **block-scoped** `set`, and `${name}`
**interpolation** inside a larger string (not just a whole `$name`
argument).

```don
set foo 33

foo $foo
tar biz {
  set foo 55
  foo $foo
}
```

```ts
import { DON } from "donly";
import { scopedVariablesPlugin } from "donly/demo/plugins/scoped-variables";

const result = DON.parse(
  `
set foo 33

foo $foo
tar biz {
  set foo 55
  foo $foo
}
`,
  { plugins: [scopedVariablesPlugin] },
);
// ? const result = Directive {
//   name: Symbol(root),
//   args: [],
//   children: [
//     Directive { name: "foo", args: [ 33 ], children: [] },
//     Directive {
//       name: "tar",
//       args: [ "biz" ],
//       children: [
//         Directive { name: "foo", args: [ 55 ], children: [] }
//       ],
//     }
//   ],
// }
```

Two top-level directives survive (`set` is dropped, same as
`variablesPlugin`), so `DON.parse()`'s usual single-top-level-directive
rule doesn't apply and the synthetic root (`name: ROOT_DIRECTIVE_NAME`)
wraps both — see [Usage](../../README.md#usage) in the README.
`tar`'s block gets its own scope (pushed by `onEnterScope` right before
`tar`'s children are visited): the `set foo 55` inside it shadows the
outer `foo` for the rest of that block only, so `tar`'s own `foo $foo`
child resolves to `55`, while the top-level `foo $foo` (visited before
`tar`'s block was ever entered) resolves to the outer scope's `33`. Once
`tar`'s block ends, `onExitScope` pops that scope back off — a sibling
directive after `tar` referencing `$foo` would see `33` again, not `55`.
Unlike `variablesPlugin`'s `Map<string, string>`, a bare `$name` resolves
to the variable's own value and type (`33` the number, not `"33"` the
string).

`${name}` interpolates a variable inside a larger string, resolving
against whichever scope is active where the string appears:

```don
set project FOO

container "${project}-container-1" {}
```

```ts
const result = DON.parse(
  `
set project FOO

container "\${project}-container-1" {}
`,
  { plugins: [scopedVariablesPlugin] },
);
// ? const result = Directive {
//   name: "container",
//   args: [ "FOO-container-1" ],
//   children: [],
// }
```

Only the `${project}` piece resolves — the surrounding `-container-1` text
stays as written. A `$name` or `${name}` reference to a variable nothing
in scope has `set` is left untouched, rather than resolving to `undefined`
or an empty string.
