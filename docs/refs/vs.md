---
title: DON vs Other DSLs
description: Comparison between DON (Directive Object Notation) and other domain-specific languages used for configuration, infrastructure, and routing.
lang: en
---

# DON vs Other DSLs

Unlike most DSLs, which are bound to a single domain (HTTP routing, container builds, IaC), DON is a general-purpose DSL: its directive-based grammar carries no built-in schema, so it can be customized with any set of directive names and arguments to fit any kind of project. This document compares it against other domain-specific languages (DSLs) commonly used for configuration, infrastructure, and routing, to highlight where DON's design choices overlap or differ.

| DSL                                  | Domain                                             | Structure model                                       | Positional arguments        | Repeated keys at same level | General-purpose (any domain) |
| ------------------------------------ | -------------------------------------------------- | ----------------------------------------------------- | --------------------------- | --------------------------- | ---------------------------- |
| **DON**                              | Configuration, infrastructure annotations, routing | Directives + nested blocks (`name arg1 arg2 { ... }`) | Yes                         | Yes                         | Yes                          |
| **Nginx config**                     | HTTP server / reverse proxy                        | Directives + nested blocks (`location /api { ... }`)  | Yes                         | Yes                         | No (HTTP only)               |
| **Caddyfile**                        | HTTP server / reverse proxy                        | Directives + nested blocks                            | Yes                         | Yes                         | No (HTTP only)               |
| **HCL** (Terraform)                  | Infrastructure as code                             | Blocks with labels + key-value attributes             | Partial (block labels only) | Yes (block labels)          | No (IaC only)                |
| **YAML**                             | General data serialization                         | Nested key-value maps and lists                       | No                          | No (requires arrays)        | Yes                          |
| **JSON**                             | General data serialization                         | Nested key-value objects and arrays                   | No                          | No (requires arrays)        | Yes                          |
| **Dockerfile**                       | Container image build steps                        | Sequential instructions (`INSTRUCTION args`)          | Yes                         | Yes                         | No (builds only)             |
| **Kubernetes manifest** (YAML-based) | Container orchestration                            | Nested key-value maps                                 | No                          | No (requires arrays)        | No (k8s schema only)         |
| **CSS**                              | Styling                                            | Selectors + property-value blocks                     | No                          | Yes (repeated selectors)    | No (styling only)            |
| **SQL**                              | Data querying                                      | Statement clauses (`SELECT ... WHERE ...`)            | Yes (clause arguments)      | No                          | No (querying only)           |
| **Gradle/Groovy DSL**                | Build configuration                                | Method calls / closures (host language)               | Yes (method args)           | Yes                         | No (JVM builds only)         |

## Key takeaways

- **DON vs Nginx/Caddyfile**: closest in spirit — directive + positional arguments + block nesting — but DON is not tied to HTTP; the same shape works for containers, security rules, or arbitrary configuration.
- **DON vs YAML/JSON**: DON avoids the extra nesting level that key-value formats need for every additional parameter (see the [README](../../README.md) for the `route GET /api` example), and natively supports repeating the same directive name at a level without wrapping it in an array.
- **DON vs HCL**: HCL supports positional labels on a block (`resource "aws_instance" "web" { ... }`) but falls back to key-value attributes inside the block; DON keeps positional arguments as the primary way to pass parameters.
- **DON vs Dockerfile**: Dockerfile is a strong precedent for directive-style, argument-first syntax, but it is a flat instruction sequence with no block nesting; DON adds nested blocks on top of that model.
