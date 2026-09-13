---
title: DON LintRule - Object Format Validation
description: Proposal for an object-format validation property on LintRule, enabling declarative lint rules that can be authored and exchanged as JSON, YAML, or other data formats.
lang: en
---

# DON LintRule - Object Format Validation

> **Status**: Draft

## Motivation

`LintRule.evaluation` (see [`src/lint.ts`](../../../src/lint.ts)) is a function,
so a rule can only be authored in code. A declarative counterpart lets simple
argument checks be expressed as plain data, which can then be serialized to
and loaded from JSON, YAML, or DON itself, without changing how existing
function-based rules work.

## Document shape: `path` as the object key

Rather than an array of `{ path, ... }` objects, a rule _document_ keys each
rule body directly by the directive path it targets:

```json
{
  "/server/port": {
    "...": "..."
  }
}
```

Every JSON example below follows this shape. It is equivalent to an array
of `LintRule` objects with an explicit `path` field — loading it just means
mapping each `[path, body]` entry to `{ path, ...body }` before passing it
to `lint()` (see [Equivalent shape](#equivalent-shape-explicit-path-field)
at the end of this document for that form, and for how two rules on the
_same_ path are expressed).

## Sub-paths: `/name` keys

Inside a rule body, any key that starts with `/` is a **relative sub-path**,
whose value is itself a rule body (optionally holding further `/`-prefixed
keys, to arbitrary depth). The effective path for a nested body is its
parent key's path plus its own — `/server` holding a `/route` key describes
`/server/route`, which holding a `/respond` key describes
`/server/route/respond`:

```json
{
  "/server": {
    "/route": {
      "/respond": {
        "...": "..."
      }
    }
  }
}
```

This describes the same rule as the flat, fully-repeated key
`"/server/route/respond"` — each path segment is written once and its
sub-rules nest under it, mirroring how `route /users { respond 200 "Ok" }`
itself nests directives. Loading it means walking the tree, joining each
`/`-prefixed key onto its parent's accumulated path, and flattening every
body into a `{ path, ...body }` `LintRule`.

## The root selector `"/"` and the wildcard `"/*"`

`"/"` alone — a slash with no name after it — addresses the document root
itself, the same as a `LintRule` with no `path` at all (see `evaluation`'s
doc comment in [`src/lint.ts`](../../../src/lint.ts): "Omit to run
`evaluation` once against the document root"). It's a body like any other,
so it can carry sub-paths, `and`/`or`, `required`, and so on. It's only
useful as an explicit key, though, when a body needs to attach something
_directly_ to the root itself — top-level document keys are already
root-relative, so nesting a sub-path under an explicit `"/"` is equivalent
to writing that sub-path as a top-level key on its own (see the example
below).

A sub-path name can also be the wildcard `"*"` — `"/*"` matches **any**
child directive regardless of name, rather than one specific name. This
matters for `max`/`min`: unlike a named sub-path (which counts only that
one name), `"/*"`'s occurrence count is _every_ child directive at that
level, of any name, combined.

## JSON example: no more than one directive at the document root

```json
{
  "/*": {
    "max": 1,
    "message": "el documento no puede tener más de una directiva en el root"
  }
}
```

This is equivalent to nesting the same body under an explicit `"/": { ... }`
key — redundant here, since the document's top level is already the root.
It matches the document root and requires at most one top-level directive,
of any name. Valid:

```don
server {
  port 3000
}
```

but invalid — two top-level directives:

```don
server {
  port 3000
}
route /health {
  respond 200 "Ok"
}
```

## Argument selectors: `[N]`

A rule body's keys also select an argument position directly, written
`"[N]"` (e.g. `"[1]"`, `"[2]"`), with a constraint object as the value — no
wrapping `args` property is needed, since the brackets already distinguish
an argument selector from a sub-path key (prefixed with `/`). It is
evaluated the same way `evaluation` is, for every directive matched by the
rule's path, and is independent of `evaluation` — a rule may declare either
or both, alongside sub-paths.

**Positions are 1-based**: the first argument is position `1`, not `0`. For
`port 3000`, `3000` is the argument selected by `"[1]"` (it maps to
`directive.args[0]` internally, but positions always count from `1`).

Each constraint accepts an optional `message` to override the default
"argument at position N must be of type T" issue message, and an optional
`severity` (`"error"`, `"warning"`, or `"info"`, default `"error"`) — passed
straight through to `LintIssue.severity` (see
[`src/lint.ts`](../../../src/lint.ts)). Every other body-level check
documented below (sub-path `max`/`min`, `required`, rule-level `and`
entries) accepts the same `message`/`severity` pair.

`type` itself only ever names one type — a union of types is expressed with
`or` (see below), not by passing `type` an array.

For numeric arguments, a constraint also accepts range checks: `gte`
(greater than or equal), `gt` (greater than), `lte` (less than or equal),
and `lt` (less than). They apply only once the argument's type has already
been checked as `number`, and can be combined to express a range.

A constraint also accepts `enum`: an array of literal values the argument
must match exactly (one of them). It is independent of `type` — when both
are set, the argument must satisfy `type` and be one of `enum`'s values.

For string arguments, a constraint also accepts `pattern`: a regular
expression (as a string, without delimiters) the argument must fully or
partially match — like `RegExp.prototype.test`. An optional `flags` string
(e.g. `"i"`) is passed along to the underlying `RegExp`. `pattern` applies
only once the argument's type has already been checked as `string`.

### `type` values

`type` covers every argument kind DON v1 produces (see
[`docs/specs/v1/spec.md`](./spec.md)): `"string"`, `"number"`, `"bigint"`,
`"boolean"`, `"null"`, and `"heredoc"`.

- `"number"` and `"bigint"` are distinct types (mirroring JS `typeof`, and
  DON's own `123` vs. `123n` literals) — both accept `gte`/`gt`/`lte`/`lt`
  range checks, compared numerically.
- `"boolean"` and `"null"` have no further refinement beyond `type` itself
  (a boolean is `true`/`false`, `null` has exactly one value) — `enum` is
  redundant with them but harmless.
- `"heredoc"` matches a `HeredocValue` argument (see
  [§2.8 Heredocs](./spec.md#28-heredocs)); `pattern` applies to its
  `content` string, and `enum` is not meaningful since heredoc content is
  rarely one of a fixed set of literals.

## JSON example: argument at position 1 must be a number

```json
{
  "/server/port": {
    "[1]": {
      "type": "number",
      "message": "port debe ser un número"
    }
  }
}
```

This rule matches directives at `/server/port` and requires the argument at
position `1` to be a `number`, reporting the custom `message` when it isn't,
e.g.:

```don
server {
  port 3000
}
```

## JSON example: a union of types (`boolean` or `number`), via `or`

```json
{
  "/server/route": {
    "[2]": {
      "or": [{ "type": "boolean" }, { "type": "number" }],
      "message": "el segundo argumento debe ser boolean o number"
    }
  }
}
```

This rule accepts either a `boolean` or a `number` at position `2` (the
second argument), e.g. both of the following are valid:

```don
server {
  route "/api" 200
  route "/health" true
}
```

(`or` is the general combinator for alternative full constraints, not just
types — see [below](#or-combining-multiple-full-constraints).)

### Shorthand: `path[N]` as a single key

The path and the argument selector can also be fused into one top-level
key, `"path[N]"`, instead of nesting `"[N]"` inside the path's body. It is
equivalent to the example above:

```json
{
  "/server/route[2]": {
    "or": [{ "type": "boolean" }, { "type": "number" }],
    "message": "el segundo argumento debe ser boolean o number"
  }
}
```

This reads as "the argument at position `2` of `/server/route`" in one key,
useful when a path has a single argument constraint and no sub-paths of its
own. It cannot be combined with a `/`-prefixed sub-path on the same key —
that still needs the nested form, since `path[N]`'s value _is_ the
constraint object, not a rule body.

## JSON example: `gte`, `gt`, `lte`, and `lt` range checks

```json
{
  "/server/port": {
    "[1]": {
      "type": "number",
      "gt": 1024,
      "lte": 65535,
      "message": "port debe ser mayor a 1024 y menor o igual a 65535"
    }
  }
}
```

This rule requires the argument at position `1` to be a `number` strictly
greater than `1024` (`gt`) and less than or equal to `65535` (`lte`); `gte`
and `lt` are the inclusive-lower/exclusive-upper counterparts, e.g.:

```don
server {
  port 8080
}
```

## JSON example: `enum` (choice among fixed values)

```json
{
  "/server/strategy": {
    "[1]": {
      "enum": ["rolling", "recreate", "blue-green"],
      "message": "strategy debe ser uno de: rolling, recreate, blue-green"
    }
  }
}
```

This rule requires the argument at position `1` to be exactly one of
`"rolling"`, `"recreate"`, or `"blue-green"`, e.g.:

```don
server {
  strategy "rolling"
}
```

## JSON example: `pattern` (regex) for a string argument

```json
{
  "/server/route": {
    "[1]": {
      "type": "string",
      "pattern": "^/[a-z0-9/_-]*$",
      "message": "el path de route debe empezar con / y usar minúsculas, dígitos, _ o -"
    }
  }
}
```

This rule requires the argument at position `1` to be a `string` matching
`^/[a-z0-9/_-]*$`, e.g. valid for `/api/users` but not for `api_Users`:

```don
server {
  route "/api/users" {
    respond 200 "Ok"
  }
}
```

## JSON example: `"boolean"` and `"null"`

```json
{
  "/server/deprecated": {
    "[1]": {
      "or": [{ "type": "boolean" }, { "type": "null" }],
      "message": "deprecated debe ser true, false, o null"
    }
  }
}
```

This rule accepts `true`, `false`, or `null` at position `1`, e.g.:

```don
server {
  deprecated true
}
```

```don
server {
  deprecated null
}
```

## JSON example: `"bigint"` with a range check

```json
{
  "/config/maxSize": {
    "[1]": {
      "type": "bigint",
      "gt": 0,
      "message": "maxSize debe ser un bigint positivo"
    }
  }
}
```

`gt`/`gte`/`lt`/`lte` compare `bigint` arguments numerically just like
`number` ones. This is valid:

```don
config {
  maxSize 1024n
}
```

but invalid — `0n` fails `gt: 0`:

```don
config {
  maxSize 0n
}
```

## JSON example: `"heredoc"` with a `pattern` on its content

```json
{
  "/server/template": {
    "[1]": {
      "type": "heredoc",
      "pattern": "<html",
      "message": "template debe contener un documento HTML"
    }
  }
}
```

This requires the heredoc's `content` to match `<html`, e.g.:

```don
server {
  template <<<HTML
    <html>
      <body>Hello</body>
    </html>
}
```

## `or`: combining multiple full constraints

`or` is the general combinator for expressing alternatives — including a
union of `type`s, as seen above. A constraint accepts an `or` property, an array of full
constraint objects (each may itself set `type`, `enum`, `pattern`, `gte`,
`gt`, `lte`, `lt`, and so on). The argument is valid when it satisfies at
least one of them. When present, `or` replaces the constraint's own
type/range/pattern/enum checks — only the alternatives inside `or` (plus the
outer `message`, used when none of them match) are evaluated.

## JSON example: `or` between two alternative validations

```json
{
  "/server/port": {
    "[1]": {
      "or": [
        { "type": "number", "gt": 1024, "lte": 65535 },
        { "type": "string", "enum": ["auto"] }
      ],
      "message": "port debe ser un número entre 1024 y 65535, o \"auto\""
    }
  }
}
```

This rule requires the argument at position `1` to be either a `number`
strictly greater than `1024` and less than or equal to `65535`, or the exact
string `"auto"`, e.g. both are valid:

```don
server {
  port 8080
}
```

```don
server {
  port "auto"
}
```

## JSON example: `or` with a ranged branch (`boolean` or a bounded `number`)

```json
{
  "/server/route": {
    "[2]": {
      "or": [
        { "type": "boolean" },
        {
          "type": "number",
          "gte": 0,
          "lte": 30000,
          "message": "el número debe estar entre 0 y 30000"
        }
      ],
      "message": "el segundo argumento debe ser boolean o number"
    }
  }
}
```

Each `or` branch is a full constraint, so range checks (`gte`/`lte` here,
not `min`/`max` — those are reserved for occurrence counts on a sub-path,
see below) live on the branch they refine. A branch's own `message` (as on
the `number` branch here) documents that branch for readers but, per the
`or` semantics above, plays no role in what gets reported — only the outer
`message` is used, whichever branch fails to match. Valid:

```don
server {
  route "/api" true
  route "/health" 200
}
```

invalid — a `number` outside the branch's range:

```don
server {
  route "/api" 50000
}
```

## `and`: requiring multiple full constraints together

`and` is `or`'s counterpart: a constraint accepts an `and` property, an
array of full constraint objects (each may itself set `type`, `enum`,
`pattern`, `gte`, `gt`, `lte`, `lt`, `or`, and so on). The argument is valid
only when it satisfies every one of them. Like `or`, when present it
replaces the constraint's own type/range/pattern/enum checks — only the
entries inside `and` (plus the outer `message`, used for whichever entry
fails first) are evaluated. `and` and `or` can nest inside each other's
entries to express arbitrary combinations.

## JSON example: `and` combining a type check and a pattern

```json
{
  "/server/route": {
    "[1]": {
      "and": [
        { "type": "string" },
        { "pattern": "^/", "message": "el path debe empezar con /" },
        {
          "pattern": "^(?!.*//).*$",
          "message": "el path no puede tener // repetidos"
        }
      ],
      "message": "el path de route es inválido"
    }
  }
}
```

This rule requires the argument at position `1` to be a `string` that both
starts with `/` and has no repeated `//`, e.g. valid for `/api/users` but
not for `api/users` or `/api//users`:

```don
server {
  route "/api/users" {
    respond 200 "Ok"
  }
}
```

## JSON example: `severity` (downgrading an issue to a warning)

```json
{
  "/server/strategy": {
    "[1]": {
      "enum": ["rolling", "recreate", "blue-green"],
      "severity": "warning",
      "message": "strategy debería ser uno de: rolling, recreate, blue-green"
    }
  }
}
```

This is the same `enum` check as the earlier example, but a mismatch is
reported as a `"warning"` instead of the default `"error"` — useful for
style-level guidance that shouldn't fail a build. `severity` accepts
`"error"`, `"warning"`, or `"info"`.

## `not`: negating a constraint

A constraint also accepts `not`: a single full constraint object (it may
itself set `type`, `enum`, `pattern`, `gte`, `gt`, `lte`, `lt`, `and`, `or`,
even a further nested `not`). The argument is valid when it does **not**
satisfy it. Like `and`/`or`, when present `not` replaces the constraint's
own type/range/pattern/enum checks — only whether the argument fails to
match the negated constraint is evaluated (plus the outer `message`, used
when it does match).

## JSON example: `not` forbidding a specific value

```json
{
  "/server/strategy": {
    "[1]": {
      "not": { "enum": ["big-bang"] },
      "message": "strategy no puede ser \"big-bang\""
    }
  }
}
```

This rule accepts any argument at position `1` except the literal string
`"big-bang"`, e.g. valid for `"rolling"` or any other value:

```don
server {
  strategy "rolling"
}
```

but invalid:

```don
server {
  strategy "big-bang"
}
```

`not` composes with `and`/`or`: e.g. `{ "and": [{ "type": "string" }, { "not": { "pattern": "^/" } }] }`
requires a `string` that does **not** start with `/`.

## Proposed properties: `max` and `min` (occurrence constraints on a sub-path)

A `/`-prefixed sub-path body (see [Sub-paths](#sub-paths-name-keys) above)
also accepts `max` and `min`: constraints on how many times that child
directive occurs under its parent (matching by name, not recursively),
alongside whatever else the sub-path's own body declares — argument
selectors, further nested sub-paths, `and`/`or`. There's no separate
`children` wrapper: the sub-path key both selects the child and carries its
occurrence limits.

`max` and `min` are both optional (`max` alone caps the count, `min` alone
requires at least that many) and accept an optional `message`. When `max`
is exceeded, the issue is reported once per extra occurrence (from the
`min + 1`-th onward, mirroring `oneRespondPerLocation` in
[`src/lint.spec.ts`](../../../src/lint.spec.ts)); when the count is below
`min`, one issue is reported for the parent directive.

## JSON example: `/route` allows only one `respond`

```json
{
  "/route": {
    "/respond": {
      "max": 1,
      "message": "solo puede existir un respond dentro de route"
    }
  }
}
```

This rule matches directives at `/route` and requires at most one `respond`
child. It is valid:

```don
route /users {
  respond 200 "Ok"
}
```

but invalid:

```don
route /users {
  respond 200 "Ok"
  respond 404 "Not found"
}
```

Because `max`/`min` live on the same sub-path body as everything else, an
occurrence limit and an argument constraint on that same child combine
without needing `and`:

```json
{
  "/route": {
    "/respond": {
      "max": 1,
      "message": "solo puede existir un respond dentro de route",
      "[1]": {
        "type": "number",
        "gte": 100,
        "lte": 599,
        "message": "el status code de respond debe estar entre 100 y 599"
      }
    }
  }
}
```

## Proposed property: `required`

`min` on a sub-path requires occurrences of a child _once its parent has
already matched_, so it can't express "this directive itself must exist
somewhere in the document" — there is no parent match to hang a sub-path
constraint off of, e.g. for a directive expected at the document root, or
one several levels deep whose intermediate ancestors aren't otherwise
constrained. A rule body fills that gap with `required: true`: when the
rule's own path matches zero directives in the document, one issue is
reported (using `message`, or a default naming the missing path).

## JSON example: `/server/port` must exist

```json
{
  "/server/port": {
    "required": true,
    "message": "server debe declarar un port"
  }
}
```

This rule requires at least one `port` directive under `/server`. It is
valid:

```don
server {
  port 3000
}
```

but invalid — `/server` exists but never declares `port`:

```don
server {
  route "/api" {
    respond 200 "Ok"
  }
}
```

`required` composes with argument selectors and sub-paths on the same
body: once the directive is confirmed to exist, the rest of the body still
validates every match of it as usual.

## JSON example: `and` combining `required` with an argument constraint

A rule-level `and` entry that omits `path` (unlike the ones in the next
section) inherits the path from its enclosing key, so a `required` check
can be combined with a further constraint — here, an `[1]` upper bound — for
the _same_ directive:

```json
{
  "/server/port": {
    "and": [
      {
        "required": true,
        "message": "server debe declarar un port"
      },
      {
        "[1]": {
          "type": "number",
          "lte": 65535,
          "message": "port debe ser menor o igual a 65535"
        }
      }
    ]
  }
}
```

This requires `/server/port` to exist, and, whenever it does, its argument
at position `1` to be a `number` less than or equal to `65535`. It is
valid:

```don
server {
  port 3000
}
```

but invalid — `port` exists but exceeds the limit:

```don
server {
  port 70000
}
```

## JSON example: `/respond` required only when `/route` exists, `/server` itself optional

`min` on a sub-path already only applies "once its parent has already
matched" (see [above](#proposed-properties-max-and-min-occurrence-constraints-on-a-sub-path)),
so a requirement that's conditional on an ancestor's existence needs no new
property — nesting `min` under that ancestor is enough:

```json
{
  "/server/route": {
    "/respond": {
      "min": 1,
      "message": "respond es obligatorio dentro de un route"
    }
  }
}
```

`/server/route` carries no `required`, so it's optional — `server` without
any `route` inside it, or no `server` at all, is fine. It's only once
`route` shows up that its own `respond` becomes required. Valid — `route`
exists and declares `respond`:

```don
server {
  route /health {
    respond 200 "Ok"
  }
}
```

but invalid — `route` exists (nested in `server`) without a `respond`:

```don
server {
  route /health {
    handler "ping"
  }
}
```

## `and` at the rule level: composing full rules

`and` isn't limited to constraints on an argument selector — a rule body
also accepts an `and` property: an array of full `{ path, ... }` rule
objects, each free to declare its own `path`, argument selectors,
sub-paths, and even a further nested `and`/`or`. This bundles several
independent checks into a single named entry even when the paths involved
aren't in a common ancestor/descendant chain that nesting could express —
useful when a schema wants to group unrelated checks as one entry instead
of one key per check. The outer key is purely a label for the group; each
nested object's own `path` is what selects which directives it runs
against.

## JSON example: `and` grouping rules for unrelated paths

```json
{
  "/server-config": {
    "and": [
      {
        "path": "/server/port",
        "required": true,
        "message": "server debe declarar un port"
      },
      {
        "path": "/route/respond",
        "[1]": {
          "type": "number",
          "gte": 100,
          "lte": 599,
          "message": "el status code de respond debe estar entre 100 y 599"
        }
      }
    ]
  }
}
```

This groups two unrelated checks under one entry, purely for organization —
the outer `/server-config` key is a label, not itself a directive path:
`/server/port` must exist, and every `/route/respond`'s first argument must
be a `number` between `100` and `599`. It is valid:

```don
server {
  port 3000
}
route /users {
  respond 200 "Ok"
}
```

but invalid — no `port` under `/server`, and a `respond` status code out of
range:

```don
server {
}
route /users {
  respond 999 "Bad"
}
```

## JSON example: sub-paths and occurrence constraints nested under `/server`

Sub-paths nest to arbitrary depth and each level can freely mix its own
`max`/`min`, argument selectors, and further sub-paths:

```json
{
  "/server": {
    "/route": {
      "max": 10,
      "message": "un server admite a lo más 10 route"
    },
    "/port": {
      "[1]": { "type": "number", "gt": 1024, "lte": 65535 }
    }
  }
}
```

This is equivalent to the flat keys `"/server/route"` (with `max: 10`) and
`"/server/port"` (with the argument constraint) written out in full.

## `or`, `and`, and `not` at the document root

The document root itself accepts `or`, `and`, and `not` directly, the same
combinators used one level down for constraints and rule bodies — but here
each entry is a _whole document_ (its own set of path keys), not a single
constraint or rule body. `or` accepts a document matching any one of
several alternative shapes; `and` requires it to satisfy all of them; `not`
requires it to satisfy none.

## JSON example: `or` between two alternative documents

```json
{
  "or": [
    { "/server/port": { "required": true } },
    { "/server/socket": { "required": true } }
  ]
}
```

This requires a `server` that declares either a `port` or a `socket` (or
both). Valid:

```don
server {
  socket "/tmp/app.sock"
}
```

but invalid — neither is declared:

```don
server {
  timeout 30
}
```

Every rule body above can also be written as one entry in an array of
`LintRule` objects, with `path` as an explicit field instead of the object
key:

```json
[
  {
    "path": "/server/port",
    "[1]": {
      "type": "number",
      "message": "port debe ser un número"
    }
  }
]
```

This is the shape closest to the `LintRule` TypeScript type in
[`src/lint.ts`](../../../src/lint.ts). Because object keys must be unique,
two independent rules for the _same_ path — which the array form expresses
as two separate entries — are combined under that one key using `and`
instead of repeating the key:

```json
{
  "/route/respond": {
    "and": [{ "[1]": { "type": "number" } }, { "[2]": { "type": "string" } }]
  }
}
```
