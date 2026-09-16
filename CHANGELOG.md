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
- `Directive#find(path)` / `Directive#findAll(path)` / `Directive#at(path)` —
  query a `Directive` (treated as the document root) using an absolute path
  expression (e.g. `/server/route`, with `|` alternatives). `find`/`findAll`
  return the first/all matching directives; `at` resolves the path, and a
  path ending in `[N]` (1-based) returns that directive's argument at
  position `N` instead of the directive itself. Backed by `findDirective`,
  `findAllDirectives`, and `atDirective` (`donly/find`), along with
  `PathExpression`, which parses and matches the path syntax also used by
  lint rule keys.
- `lintSchema(don, rules)` (also exported as `lint`, from `donly/lint`) — runs
  a declarative `LintRuleDocument` against a DON source string and returns
  the `LintIssue`s it reports. A rule document is keyed by directive path
  (e.g. `"/server/port"`), optionally fused with a 1-based argument selector
  (`"/server/port[1]"`); each body may combine `required`/`min`/`max`
  occurrence checks, nested sub-paths, `"[N]"` argument constraints
  (`type`, `enum`, `gt`/`gte`/`lt`/`lte`, `pattern`/`flags`, `or`/`and`/
  `not`), and an `evaluation` escape hatch. See `docs/lint/rules.md` for the
  full format. `renderReport`/`renderJSONReport` turn a `LintIssue[]` into an
  ESLint-style text report or a `JSONReport`. The previous function-based
  `LintRule`/`evaluation` engine moved internal (`src/lint.ts`, deprecated,
  no longer published as `donly/lint`).
- `donly` CLI (`bin/donly.js`, invoke with `npx donly`/`bunx donly`) with a
  `donly lint --rules <rules.json> <file>` command: runs `lintSchema` against
  a `.donly` file using a `LintRuleDocument` JSON file, prints an ESLint-style
  report via `renderReport`, and exits non-zero when any issue is an error.
  Accepts `--output`/`-o` `default | json` to switch between `renderReport`'s
  text report (default) and `renderJSONReport`'s `JSONReport`. Also adds a
  `donly inspect [--strategy|-s nested|tuple|raw] <file>` command: parses a
  `.donly` file and prints it as JSON via `DirectiveJSONEncoder`, defaulting
  to the `nested` reducer (`tuple` and `raw`, the lossless
  `{ name, args, children }` shape, are also available).
