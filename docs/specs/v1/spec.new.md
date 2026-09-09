---
title: DON Specification v1 - Directive Object Notation
description: Complete specification for DON v1, a human-readable data serialization format designed for configuration files, routers, and security rules. Learn syntax, directives, blocks, and examples.
lang: en
status: Draft
generatedAt: 2026-09-09T15:11:15.071Z
---

# DON Specification v1

> **Status**: Draft

## 1. Overview

DON (Directive Object Notation) v1 is a human-readable data serialization format built around directives and subdirectives. This format is designed for configuration files such as security rules, routers, reverse proxies, and similar use cases.

## 1.1 DON vs JSON

DON differs fundamentally from JSON in its approach to data representation. While JSON is a key-value structure designed for object serialization, DON uses a directive-based model that more closely resembles program execution with repeated function calls.

In DON, a declaration like:

```don
name "john"
```

Is conceptually equivalent to a function call in JavaScript:

```js
new Directive("name", ["john"], []);
```

Consider a dependencies declaration:

```don
dependencies {
  zod ">=1"
  react ">=5"
}
```

Its equivalent `Directive` tree:

```js
new Directive("dependencies", [], [new Directive("zod", [">=1"], []), new Directive("react", [">=5"], [])]);
```

And its JSON equivalent:

```json
{
  "dependencies": {
    "zod": ">=1",
    "react": ">=5"
  }
}
```
