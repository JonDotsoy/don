---
title: Path Expressions
description: The /-separated path syntax used to address directives — segments, escaping, wildcards, and (...) argument matching — shared by find/findAll/at and the lint rule schema.
lang: en
---

# Path Expressions

> Implementation: [`src/path-expression/path-expression.ts`](../../src/path-expression/path-expression.ts)

A **path expression** is the small `/`-separated syntax used to address a
directive (or several) inside a parsed DON document, without walking
`children` by hand. It's what powers `Directive#find`/`#findAll`/`#at` and
the standalone `findDirective`/`findAllDirectives`/`atDirective` exports
(see [Finding Directives](../../README.md#finding-directives) in the
README), and it's also the matcher the [lint rule
schema](../lint/rules.md) uses under the hood for its `/name` sub-path
keys — the syntax described here is the same one those sub-path keys
accept.

`PathExpression.parse(path)` turns a path string into a `PathExpression`
(`{ parts, selectArgument? }`); `PathExpression.match(directive,
expression, positionSegment)` checks a single directive against one
segment of an already-parsed expression. Everything below describes what
that parser accepts and how that matcher decides a match.

## Splitting a path into segments: `/`

A path is one or more segments separated by `/`, read left to right as a
descent from the starting directive down through its `children`:

- `"/"` (or `""`) — no segments at all. This addresses the starting
  directive itself and imposes no constraint — it always matches.
- `"/server"` — one segment, `server`: children named `server` of the
  starting directive.
- `"/server/route"` — two segments: `route` children of whatever `server`
  matched.

Each segment is checked against `directive.name` one level at a time —
`PathExpression.match` only ever looks at the one segment named by
`positionSegment`; a caller (`findAllDirectives`, or lint-schema's own
traversal) is the one that walks `children` and advances through the rest
of the segments.

## Escaping: `\`

A `\` makes the character right after it literal, instead of letting it
act as a separator, a wildcard, or a `(`/`)` group delimiter. This is what
lets a path address a directive whose own name contains one of those
characters — DON identifiers may contain `/` (see the [spec, §2.3
Identifiers](../specs/v1/spec.md#23-identifiers)):

```ts
import { DON } from "donly";

const root = DON.parse(`
/user {
  respond 200 "Ok"
}
`);

root.find("/\\/user");
// ? Directive { name: "/user", args: [], children: [...] }
```

Without the `\`, `/user` inside the path would be read as the separator
`/` followed by the segment `user` — a different, unrelated directive. The
same escaping applies inside a segment or an argument for `*`, `(`, and
`)`, so any of those can be matched as a literal character instead of
triggering wildcard or argument-group parsing.

## Wildcards: `*`

A `*` inside a segment (or an argument, see below) turns it from a literal
into a **pattern**: the pieces around and between the `*`s become a
`prefix`/`chunks`/`suffix` the value must start with, contain in order,
and end with, respectively — pieces that are empty are simply not
required.

| Path segment | Matches directive names... |
| --- | --- |
| `foo` | equal to `foo` (a plain literal — no `*` at all) |
| `*` | any name at all (an empty pattern — no prefix, chunks, or suffix) |
| `foo*` | starting with `foo` |
| `*foo` | ending with `foo` |
| `foo*biz` | starting with `foo` and ending with `biz` |
| `foo*biz*tar` | starting with `foo`, ending with `tar`, containing `biz` somewhere in between |

```ts
root.findAll("/server/route*");
// every `route*` child of `server` — `route`, `routeGET`, `routeAPI`, ...

root.findAll("/server/*");
// every child of `server`, regardless of name
```

A bare `*` as a whole segment (`"/server/*"`) is the idiomatic
any-directive wildcard — it's an empty pattern, which matches unconditionally.

## Argument matching: `(...)`

A segment can carry a `(...)` group right after its name to also constrain
the directive's **arguments**, space-separated inside the parentheses —
one token per argument position, matched pairwise against
`directive.args`:

```ts
const root = DON.parse(`
server {
  route /home
  route GET /api/user
  route POST /api/user
}
`);

root.find("/server/route(/home)");
// ? Directive { name: "route", args: ["/home"], children: [] }

root.findAll("/server/route(* /api/user)");
// ? [
//     Directive { name: "route", args: ["GET", "/api/user"], children: [] },
//     Directive { name: "route", args: ["POST", "/api/user"], children: [] },
//   ]
```

Each token inside `(...)` is itself parsed the same `*`-tokenized way a
segment name is — `GET` is a literal argument, `*` is a wildcard argument
(matches any single value), and `api*` / `*api` / `api*list` work the same
prefix/suffix/chunk patterns described above, applied to that one
argument instead of the directive's name. Non-string argument values
(numbers, booleans, ...) are stringified before matching a literal or
pattern, so `(8080)` matches a `port` directive whose argument is the
number `8080`.

A segment with **no** `(...)` at all (`"/route"`) matches regardless of
the directive's arguments — it doesn't look at `args` in any way. Adding
`(...)` — even an empty `()` — starts constraining them:

```ts
root.find("/server/route()");
// only a `route` with zero arguments

root.find("/server/route(GET /api)");
// only a `route` whose args are exactly ["GET", "/api"]
```

### Matching by argument count: `(* * *)`

Because every bare `*` inside `(...)` matches any single argument value,
a group made of nothing but `*`s constrains **only how many** arguments
the directive has, not what they are. `(* * *)` matches any directive with
exactly three arguments, whatever their values:

```ts
const root = DON.parse(`
route "/api" GET 200
route "/api" GET
`);

root.findAll("/route(* * *)");
// ? [ Directive { name: "route", args: ["/api", "GET", 200], children: [] } ]
```

This follows directly from how a `(...)` group is matched — it's not a
separate feature, just the natural result of `*`'s "any single argument"
meaning combined with the rule that **argument count must match
exactly**: a directive only matches a `(...)` group when `directive.args.length`
equals the number of space-separated tokens inside it. `route "/api" GET`
above (two arguments) doesn't match `(* * *)` (three tokens) even though
every token is a wildcard — add or remove a `*` to require more or fewer
arguments, regardless of their content.

## Selecting an argument: a trailing `[N]`

A path can end in `[N]` to additionally select one argument off whatever
directive the rest of the path matches, instead of the directive itself.
**Positions are 1-based** — `[1]` is the first argument, `[2]` the second,
and so on. It's parsed off separately into `selectArgument` (still
1-based) and plays no part in `PathExpression.match`'s own matching rules
— it only matters to a caller like `at`/`atDirective` that wants to
resolve it:

```ts
root.at("/server/route(GET /api)/respond[1]");
// ? 200 — the respond directive's argument at position 1, i.e. args[0]
```

`[N]` composes with a `(...)` group on the very same segment:
`"/foo(tar biz)[1]"` both constrains `foo`'s arguments to exactly `["tar",
"biz"]` and, once matched, selects the argument at position `1` (`"tar"`).

> **Note:** `find`/`at`/`findAll`/`atDirective` (this module) and the
> [lint rule schema](../lint/rules.md#argument-selectors-n)'s own `[N]`
> argument selectors on `/name` sub-path keys both use this same
> **1-based** convention — position `1` is `directive.args[0]`.

## Summary

| Syntax | Meaning |
| --- | --- |
| `/` or `""` | No constraint — matches the starting directive itself |
| `/name` | A `/`-separated segment — descends into a child by name |
| `\c` | Escapes `c` (a `/`, `(`, `)`, or `*`) so it's read literally |
| `*` | Wildcard — matches any name (as a segment) or any single value (as an argument) |
| `pre*`, `*suf`, `pre*suf`, `pre*mid*suf` | Prefix/suffix/chunk pattern, on a segment name or an argument |
| `name(a b c)` | Matches only when `args` has exactly 3 entries, each matching `a`, `b`, `c` pairwise |
| `name(* * *)` | Matches only by argument **count** (here, exactly 3) — every token is a wildcard |
| `name()` | Matches only a directive with zero arguments |
| `name` (no `(...)`) | Matches regardless of arguments — they aren't checked at all |
| `...[N]` | Selects argument `N` off the matched directive (informative — see note above) |
