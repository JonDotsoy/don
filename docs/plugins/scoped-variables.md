---
title: Scoped Variables
description: Block-scoped set/$name/${name} variable resolution — as a DonPlugin (scopedVariablesPlugin, for DON.parse()) and as a standalone post-parse resolver (resolveScopedVariables), both built on DonPlugin#afterChildren's block-exit signal.
lang: en
---

# Scoped Variables

> Implementation: [`src/plugins/scope.ts`](../../src/plugins/scope.ts),
> [`scoped-variables-plugin.ts`](../../src/plugins/scoped-variables-plugin.ts),
> [`scoped-variables-resolver.ts`](../../src/plugins/scoped-variables-resolver.ts)
> Import path: `donly/plugins/scoped-variables`
> Design background: [References](../concepts/references.md), Proposal 2

Two entry points resolve the same `set`/`$name`/`${name}` variables,
with `set` **block-scoped**: a `set` inside a block shadows one of the
same name from an enclosing block only for the rest of that inner
block, then reverts once the block ends.

- **`scopedVariablesPlugin`** — a `DonPlugin`, passed to `DON.parse()`
  itself:

  ```ts
  import { DON } from "donly";
  import { scopedVariablesPlugin } from "donly/plugins/scoped-variables";

  const result = DON.parse(payload, { plugins: [scopedVariablesPlugin] });
  ```

- **`resolveScopedVariables`** — a standalone function, run over a
  `Directive` tree that already exists, whether or not it came from
  `DON.parse()` at all:

  ```ts
  import { resolveScopedVariables } from "donly/plugins/scoped-variables";

  const resolved = resolveScopedVariables(root);
  ```

Both are exported together from `donly/plugins/scoped-variables`, and
share the exact same scope rules and helper code
([`src/plugins/scope.ts`](../../src/plugins/scope.ts)) — pick whichever
fits how the tree reaches you: `scopedVariablesPlugin` when you're
calling `DON.parse()` yourself, `resolveScopedVariables` when you
already have a `Directive` from somewhere else (`DirectiveJSONDecoder`,
a tree built by hand, or one already parsed without this plugin).

This is the same `set`/variable idea
[`variablesPlugin`](../concepts/plugins.md#example-1-variablesplugin)
demonstrates, but with two differences that plugin doesn't have: real
block scoping (`variablesPlugin` keeps one flat, document-wide `ctx`,
so a nested `set` permanently overwrites an outer one), and values that
keep their original type instead of being coerced to strings.

## Why this needed a new `DonPlugin` hook

[`DonPlugin#onDirective`](../concepts/plugins.md#creating-a-plugin)
fires exactly once per directive, depth-first pre-order, before that
directive's own children are visited — and never again for that
directive. On its own, there's no matching "this block's children are
all done" signal. That's enough for `variablesPlugin`'s flat `ctx` (a
`set` just keeps overwriting the same shared `Map` entry forever), but
it can't express a shadow being **restored**: once a nested `set foo
55` overwrites the outer `foo`, nothing tells a plugin built only on
`onDirective` when that inner block has ended so it could put the
outer value back.

[`DonPlugin#afterChildren`](../../src/plugin.ts) is exactly that
missing signal, added specifically to make `scopedVariablesPlugin`
possible: it fires once per directive, right after every one of its
children has been fully visited (and never at all for a directive
`onDirective` dropped by returning `null`, since a dropped directive's
children are never visited either). `scopedVariablesPlugin`'s
`onDirective` pushes a new `Scope` (chained to the current one) before
this directive's own children get visited; `afterChildren` pops it
back off right after they're done — so a `set` bound inside that scope
never outlives the block it was written in.

`resolveScopedVariables` doesn't need `afterChildren` (or a `Scope`
stack) at all: it already has a full `Directive` tree to work with, so
it keeps a `WeakMap<Directive, Map<string, ScopedValue>>`, keyed by
the _source_ directive that owns each block, and reads a name back by
walking [`Directive#parent`](../../src/don.ts) outward —
`getValue(directive, name) ?? getValue(directive.parent, name) ?? …`
— until some ancestor's entry has it or the root is reached. A `set`
only ever writes into the one `WeakMap` entry for the block it's a
direct child of, so it's naturally invisible once that block's
resolution is done and the walk moves past it.

## Walkthrough

Either entry point, given:

```don
set foo 33

foo $foo
tar biz {
  set foo 55
  foo $foo
}
```

produces a root wrapping:

```ts
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

Walking through what happened, in visit order:

1. `set foo 33` — bound in the top-level scope, then dropped (`set`
   never survives into the result, same as `variablesPlugin` drops it).
2. `foo $foo` — a bare `$foo` argument resolves against that same
   top-level scope: `33`, kept as a `number`, not stringified.
3. `tar biz { ... }` — `tar`'s own argument (`biz`) resolves against
   the top-level scope too (unaffected, no `$` in it); its block gets a
   **fresh, nested scope** chained to the top-level one.
4. `set foo 55` (inside `tar`) — binds `foo` in `tar`'s own nested
   scope, **shadowing** the top-level `foo` for the rest of `tar`'s
   block only.
5. `foo $foo` (inside `tar`) — resolves against `tar`'s nested scope:
   `55`.

Had there been a directive after `tar`'s block closed referencing
`$foo` again, it would see `33` — `tar`'s `set foo 55` never escapes
the block it was written in.

`set foo 33` and `tar biz { ... }` were two of three original top-level
directives; dropping `set` leaves two (`foo`, `tar`), so the result
stays wrapped in a synthetic root. For `scopedVariablesPlugin`, that
wrapping is `DON.parse()`'s own doing — it already re-derives its
single-top-level-directive unwrap rule against whatever a plugin's
`onDirective` leaves behind (see the README's
[Usage](../../README.md#usage)), the same way it does for
`variablesPlugin` dropping a `set`. `resolveScopedVariables` re-derives
that same rule itself, since it runs after `DON.parse()` has already
made its own wrap/unwrap decision against the _unresolved_ tree — so a
document that drops down to exactly one top-level directive (its only
other directive was a `set`) comes back unwrapped either way.

## Bare `$name` vs. `${name}` template interpolation

Two distinct forms, both looked up against the same scope chain:

- **Bare `$name`** (no braces) — the _entire_ argument is replaced by
  the bound value, unchanged in type. `set foo 33` then `bar $foo`
  produces `Directive{name:"bar", args:[33]}` — a `number`, not `"33"`.
- **`${name}` inside a larger string** — interpolated as text
  (`String(value)`) into that string, leaving the rest of it alone:

  ```don
  set project "FOO"

  container "${project}-container-1" {}
  ```

  resolves to `Directive{name:"container", args:["FOO-container-1"]}`.

- **`\${name}`** (backslash-escaped) is left as the literal text
  `${name}` — never interpolated. This reuses the same backslash DON's
  own string literals already use to escape their delimiter (see
  [the spec](../specs/v1/spec.md#25-strings)); resolution strips just
  the leading `\` for an escaped `${...}`, same as `\"` strips down to
  a literal `"`.

Neither entry point can currently tell a single-quoted string apart
from a double-quoted one — both decode to a plain JS string by the
time a `Directive` (or a `PluginDirectiveNode`) exists, with no record
of which quote character was used (see Proposal 2's quoting decisions
in [References](../concepts/references.md) for where this limitation
is discussed at the language-design level). So `${name}` interpolates
inside **any** string argument containing it, regardless of which
quotes it was written with.

## Errors

Both `scopedVariablesPlugin` and `resolveScopedVariables` throw
(rather than silently leaving a token unresolved) when:

- A bare `$name` or a `${name}` template names a variable no scope in
  its chain has bound.
- A `set` directive doesn't have exactly one name and one value
  argument (`set <name> <value>` — the extended `set` forms sketched in
  [References](../concepts/references.md#extending-setname-beyond-string-interpolation)
  aren't implemented here).
- A `${name}` template's bound value is a `HeredocValue` — there's no
  sensible way to splice multi-line heredoc content into the middle of
  a string.

## Related

- [Plugins](../concepts/plugins.md) — the `DonPlugin` mechanism
  `scopedVariablesPlugin` is built on, including `onDirective`,
  `variablesPlugin` (the flat, string-coercing sibling this module
  evolved from), and `createResourcesPlugin`.
- [References](../concepts/references.md) — the fuller, still-in-design
  discussion this implementation is one settled slice of (block
  scoping, the escape decision, and the still-open `&`/`$ref`/extended
  `set` proposals this page doesn't cover).
