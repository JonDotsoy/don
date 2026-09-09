# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

This changelog tracks changes to the `donly` library's public API (parsing,
stringifying, and the `DON`/`Directive` types) — not to CI, tooling, or
documentation.

## [Unreleased]

### Added

- `DON.parse(text)` — parses a DON document into an array of `Directive` nodes.
- `Directive` — represents a parsed directive with `name`, `args`
  (`number | string | boolean`), and nested `children: Directive[]`.
- Directives with zero or more positional arguments (`name "my-app"`, `port 8080`).
- Blocks (`{ ... }`) for arbitrarily nested subdirectives.
- Repeated directive names at the same level (e.g. multiple `route` directives).
- Identifiers with special characters (`$`, `-`, `/`, `:`, `[`, `]`), including
  interpolation-like tokens (`${name}`) and path-like tokens (`/api/:name`).
- Numeric literals: integers, decimals, hexadecimal (`0x`), octal (`0o`), binary
  (`0b`), and BigInt (`n` suffix, including hex/octal/binary BigInt).
- String literals with single or double quotes and escaped delimiters (`\"`, `\'`).
- Boolean (`true`/`false`) and `null` literals.
- Heredoc syntax (`<<<DELIMITER`) for multi-line content blocks with
  indentation-based payload extraction.
- Single-line (`#`) and multi-line (`/* ... */`, non-nesting) comments.
- `LexerParser` and `SyntaxEncode` — lower-level tokenizer and syntax parser
  exports for building custom tooling on top of DON.
- `donToParts(text)` — utility to break a DON document into typed lexical parts.
