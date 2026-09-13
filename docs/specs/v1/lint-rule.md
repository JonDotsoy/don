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
argument positions (stringified indexes into `directive.args`) and whose
values are constraints checked against the argument at that position. It is
evaluated the same way `evaluation` is, for every directive matched by
`path`, and is independent of `evaluation` — a rule may declare either or
both.

Each constraint accepts an optional `message` to override the default
"argument at position N must be of type T" issue message.

`type` also accepts an array of types (a union): the argument is valid when
it matches any one of them.

## JSON example: argument at position 1 must be a number

```json
{
  "path": "/server/route",
  "args": {
    "1": {
      "type": "number",
      "message": "el status code debe ser un número"
    }
  }
}
```

This rule matches directives at `/server/route` and requires
`directive.args[1]` to be a `number`, reporting the custom `message` when it
isn't, e.g.:

```don
server {
  route "/api" 200
}
```

## JSON example: union type (`boolean` or `number`)

```json
{
  "path": "/server/route",
  "args": {
    "1": {
      "type": ["boolean", "number"],
      "message": "el segundo argumento debe ser boolean o number"
    }
  }
}
```

This rule accepts either a `boolean` or a `number` at `directive.args[1]`,
e.g. both of the following are valid:

```don
server {
  route "/api" 200
  route "/health" true
}
```
