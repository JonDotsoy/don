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

## Proposed property: `args`

`LintRule` gains an optional `args` property: an object whose keys are
argument positions and whose values are constraints checked against the
argument at that position. It is evaluated the same way `evaluation` is, for
every directive matched by `path`, and is independent of `evaluation` — a
rule may declare either or both.

**Positions are 1-based**: the first argument is position `1`, not `0`. For
`port 3000`, `3000` is the argument at position `1` (it maps to
`directive.args[0]` internally, but `args` keys always count from `1`).

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
  "path": "/server/port",
  "args": {
    "1": {
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
  "path": "/server/route",
  "args": {
    "2": {
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
  "path": "/server/port",
  "args": {
    "1": {
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
  "path": "/server/strategy",
  "args": {
    "1": {
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
  "path": "/server/route",
  "args": {
    "1": {
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
  "path": "/server/port",
  "args": {
    "1": {
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

## Proposed property: `children`

`LintRule` also gains an optional `children` property: an object whose keys
are child directive names and whose values are occurrence-count constraints
checked against `directive.children` (matching by name, not recursively) for
every directive matched by `path`. It composes with `args` and `evaluation`
the same way — a rule may declare any combination of the three.

Each constraint accepts `min` and `max` (both optional; `max` alone caps the
count, `min` alone requires at least that many) and an optional `message`.
When `max` is exceeded, the issue is reported once per extra occurrence
(from the `min + 1`-th onward, mirroring `oneRespondPerLocation` in
[`src/lint.spec.ts`](../../../src/lint.spec.ts)); when the count is below
`min`, one issue is reported for the parent directive.

## JSON example: `/route` allows only one `respond`

```json
{
  "path": "/route",
  "children": {
    "respond": {
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
