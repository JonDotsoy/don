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

Rather than an array of `{ path, ... }` objects, a rule *document* keys each
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
*same* path, or nested sub-paths, are expressed).

## Argument selectors: `[N]`

A rule body's keys select an argument position directly, written `"[N]"`
(e.g. `"[1]"`, `"[2]"`), with a constraint object as the value — no wrapping
`args` property is needed, since the brackets already distinguish an
argument selector from a `children` key (a bare directive name) or a nested
sub-path key (prefixed with `/`). It is evaluated the same way `evaluation`
is, for every directive matched by the rule's path, and is independent of
`evaluation` — a rule may declare either or both, alongside `children`.

**Positions are 1-based**: the first argument is position `1`, not `0`. For
`port 3000`, `3000` is the argument selected by `"[1]"` (it maps to
`directive.args[0]` internally, but positions always count from `1`).

Each constraint accepts an optional `message` to override the default
"argument at position N must be of type T" issue message.

`type` also accepts an array of types (a union): the argument is valid when
it matches any one of them.

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

## JSON example: union type (`boolean` or `number`)

```json
{
  "/server/route": {
    "[2]": {
      "type": ["boolean", "number"],
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

## `or`: combining multiple full constraints

`type` as an array only unions plain types (see above). `or` is the general
combinator: a constraint accepts an `or` property, an array of full
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
        { "pattern": "^(?!.*//).*$", "message": "el path no puede tener // repetidos" }
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

## Proposed property: `children`

A rule body also gains an optional `children` property: an object whose
keys are child directive names and whose values are occurrence-count
constraints checked against `directive.children` (matching by name, not
recursively) for every directive matched by the rule's path. It composes
with argument selectors and `evaluation` the same way — a rule may declare
any combination of them.

Each constraint accepts `min` and `max` (both optional; `max` alone caps the
count, `min` alone requires at least that many) and an optional `message`.
When `max` is exceeded, the issue is reported once per extra occurrence
(from the `min + 1`-th onward, mirroring `oneRespondPerLocation` in
[`src/lint.spec.ts`](../../../src/lint.spec.ts)); when the count is below
`min`, one issue is reported for the parent directive.

## JSON example: `/route` allows only one `respond`

```json
{
  "/route": {
    "children": {
      "respond": {
        "max": 1,
        "message": "solo puede existir un respond dentro de route"
      }
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

## `and` at the rule level: composing full rules

`and` isn't limited to constraints on an argument selector — a rule body
also accepts an `and` property: an array of full `{ path, ... }` rule
objects, each free to declare its own `path`, argument selectors,
`children`, and even a further nested `and`/`or`. This bundles several
independent checks, across different directive paths, into a single named
entry — useful when a schema wants to group "everything a `route` must
satisfy" as one entry instead of one key per check. The outer key is purely
a label for the group; each nested object's own `path` is what selects
which directives it runs against.

## JSON example: `and` grouping rules for different paths under `/route`

```json
{
  "/route": {
    "and": [
      {
        "path": "/route",
        "children": {
          "respond": {
            "max": 1,
            "message": "solo puede existir un respond dentro de route"
          }
        }
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

This groups two checks under one entry: `/route` allows at most one
`respond` child, and every `/route/respond`'s first argument must be a
`number` between `100` and `599`. It is valid:

```don
route /users {
  respond 200 "Ok"
}
```

but invalid — two `respond` children, and the second one's status code is
out of range:

```don
route /users {
  respond 200 "Ok"
  respond 999 "Bad"
}
```

## Nested shape: sub-paths as nested objects

The flat map above repeats each ancestor path in full (`/route`,
`/route/respond`). Nested instead, any key that starts with `/` inside a
rule body is a **relative sub-path**, whose value is itself a rule body
(optionally holding further `/`-prefixed keys). The effective path for a
nested body is its parent key's path plus its own — `/server` holding a
`/route` key describes `/server/route`, which holding a `/respond` key
describes `/server/route/respond`. `children`, `and`, `or`, `message`, and
`[N]` argument selectors are always body fields, never sub-paths, so the
two kinds of key never collide.

```json
{
  "/server": {
    "children": {
      "route": { "max": 10, "message": "un server admite a lo más 10 route" }
    },
    "/port": {
      "[1]": { "type": "number", "gt": 1024, "lte": 65535 }
    },
    "/route": {
      "children": {
        "respond": {
          "max": 1,
          "message": "solo puede existir un respond dentro de route"
        }
      },
      "/respond": {
        "[1]": {
          "type": "number",
          "gte": 100,
          "lte": 599,
          "message": "el status code de respond debe estar entre 100 y 599"
        }
      }
    }
  }
}
```

This describes the same four rules as the flat map above (`/server`,
`/server/port`, `/server/route`, `/server/route/respond`), but each path
segment is written once and its sub-rules nest under it — mirroring how
`route /users { respond 200 "Ok" }` itself nests directives. Loading it
means walking the tree, joining each `/`-prefixed key onto its parent's
accumulated path, and flattening every body into a `{ path, ...body }`
`LintRule`.

## Equivalent shape: explicit `path` field

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
two independent rules for the *same* path — which the array form expresses
as two separate entries — are combined under that one key using `and`
instead of repeating the key:

```json
{
  "/route/respond": {
    "and": [
      { "[1]": { "type": "number" } },
      { "[2]": { "type": "string" } }
    ]
  }
}
```
