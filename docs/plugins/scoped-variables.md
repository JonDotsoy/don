---
title: Scoped Variables
description: resolveScopedVariables — block-scoped set/$name/${name} variable resolution over an already-parsed Directive tree, and why it's a standalone resolver rather than a DonPlugin.
lang: en
---

# Scoped Variables

> Implementation: [`src/plugins/scoped-variables-resolver.ts`](../../src/plugins/scoped-variables-resolver.ts)
> Import path: `donly/plugins/scoped-variables`
> Design background: [References](../concepts/references.md), Proposal 2

`resolveScopedVariables` resolves `set`/`$name`/`${name}` variables over
an already-parsed `Directive` tree, with `set` **block-scoped**: a `set`
inside a block shadows one of the same name from an enclosing block only
for the rest of that inner block, then reverts once the block ends. This
is the same `set`/variable idea [`variablesPlugin`](../concepts/plugins.md#example-1-variablesplugin)
demonstrates, but with two differences that plugin doesn't have: real
block scoping (`variablesPlugin` keeps one flat, document-wide `ctx`),
and values that keep their original type instead of being coerced to
strings.

## Why this isn't a `DonPlugin`

[`DonPlugin#onDirective`](../concepts/plugins.md#creating-a-plugin)
fires exactly once per directive, depth-first pre-order, before that
directive's own children are visited — and never again for that
directive. There's no matching "this block's children are all done"
callback. That's enough for `variablesPlugin`'s flat `ctx` (a `set`
just keeps overwriting the same shared `Map` entry forever), but it
can't express a shadow being **restored**: once a nested `set foo 55`
overwrites the outer `foo`, nothing tells a `DonPlugin` when that inner
block has ended so it could put the outer value back.

`resolveScopedVariables` sidesteps this by not being a `DonPlugin` at
all. It's a plain function, `(root: Directive) => Directive`, that runs
**after** `DON.parse()` has already built the tree, and walks that tree
with its own recursion — so it fully controls when a new scope begins
(right before descending into a block's children) and when it ends
(simply by returning from that recursive call, letting the scope object
fall out of reach the ordinary way a JS closure would).

## API

```ts
import { resolveScopedVariables } from "donly/plugins/scoped-variables";

function resolveScopedVariables(root: Directive): Directive;
```

Takes the `Directive` `DON.parse()` returns and returns a new,
resolved `Directive` tree — it never mutates the tree it's given.
Compose the two calls directly:

```ts
import { DON } from "donly";
import { resolveScopedVariables } from "donly/plugins/scoped-variables";

const result = resolveScopedVariables(
  DON.parse(`
set foo 33

foo $foo
tar biz {
  set foo 55
  foo $foo
}
`),
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
stays wrapped in a synthetic root — `resolveScopedVariables` re-derives
`DON.parse()`'s own single-top-level-directive unwrap rule (see the
README's [Usage](../../README.md#usage)) against the _resolved_ list,
so a document that drops down to exactly one top-level directive (its
only other directive was a `set`) comes back unwrapped too, the same
way it would if it had been written with just that one directive from
the start.

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
  [the spec](../specs/v1/spec.md#25-strings)); `resolveScopedVariables`
  strips just the leading `\` for an escaped `${...}`, same as `\"`
  strips down to a literal `"`.

`resolveScopedVariables` cannot currently tell a single-quoted string
apart from a double-quoted one — both decode to a plain JS string by
the time a `Directive` exists, with no record of which quote character
was used (see Proposal 2's quoting decisions in
[References](../concepts/references.md) for where this limitation is
discussed at the language-design level).
So `${name}` interpolates inside **any** string argument containing it,
regardless of which quotes it was written with.

## Errors

`resolveScopedVariables` throws (rather than silently leaving a token
unresolved) when:

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

- [Plugins](../concepts/plugins.md) — the `DonPlugin` mechanism this
  resolver deliberately isn't, including `variablesPlugin`, the flat,
  string-coercing sibling this module evolved from.
- [References](../concepts/references.md) — the fuller, still-in-design
  discussion this implementation is one settled slice of (block
  scoping, the escape decision, and the still-open `&`/`$ref`/extended
  `set` proposals this page doesn't cover).
