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
