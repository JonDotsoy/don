# DON TextMate Grammar

A TextMate grammar and language configuration for [DON (Directive Object
Notation)](../../docs/specs/v1/spec.md), for use in VS Code, Kiro, or any
other editor that consumes TextMate grammars.

## Files

- `don.tmLanguage.json` — the TextMate grammar (`scopeName: source.don`),
  covering directives, blocks (`{ }`), identifiers, strings, numbers
  (integer/hex/octal/binary/decimal/bigint), booleans, `null`, heredocs
  (`<<<DELIMITER`), and line/block comments.
- `language-configuration.json` — comment tokens, bracket pairs, and
  auto-closing/surrounding pairs for the `don` language.
- `package.json` — a minimal VS Code extension manifest that registers the
  `don` language for the `.don`/`.donly` extensions and wires up the two
  files above.
- `samples/` — sample `.don` documents used to smoke-test the grammar.
- `scripts/validate-grammar.ts` — validates that the grammar is well-formed
  (valid JSON, every pattern compiles as a regular expression) and that its
  directive-name rule matches real DON source in `samples/`.
- `tests/unit/*.test.don` — scope-assertion unit tests
  (`# SYNTAX TEST "source.don" "..."` + `^`/`<-` assertion comments) run with
  [`vscode-tmgrammar-test`](https://github.com/PanAeon/vscode-tmgrammar-test)
  against the actual `vscode-textmate` tokenizer:
  - `basics.test.don` — directive names, integers, booleans, `null`,
    decimals, bigint, hex, line comments, block braces
  - `numbers.test.don` — negative integers, octal, binary, hex bigint,
    negative decimals, bigint
  - `strings.test.don` — double/single-quoted strings and `\"`/`\'` escapes
  - `comments.test.don` — inline line comments and single/multi-line block
    comments
  - `heredoc.test.don` — `<<<DELIMITER` heredoc opener and delimiter name
  - `identifiers-and-blocks.test.don` — path-like/`$`-prefixed identifiers
    as directive arguments and nested blocks

## Validate

```sh
bun ide/textmate/scripts/validate-grammar.ts
```

Runs a lightweight structural check (valid JSON, every regex compiles, the
directive-name rule fires on the sample files) with no extra dependencies.

## Test against vscode-textmate

```sh
cd ide/textmate
bun install
bunx vscode-tmgrammar-test 'tests/unit/**/*.test.don'
```

This tokenizes every `tests/unit/*.test.don` file with the real
`vscode-textmate` engine (the same one VS Code uses) and checks the
resulting scopes against the `^`/`<-` assertions in each file.
`package.json` in this directory already declares the `don` language and
grammar, so no `-g`/`-c` flags are needed when run from `ide/textmate/`.
The `.github/workflows/textmate.yml` CI workflow runs this same command on
every pull request or push to `develop` that touches `ide/textmate/`.

## Use in VS Code

Point VS Code at this directory as an unpacked extension (or copy it into
`~/.vscode/extensions/`) to get `.don`/`.donly` syntax highlighting.

## Publish to the VS Code Marketplace

The extension is published as [`jondotsoy.don-textmate`](https://marketplace.visualstudio.com/items?itemName=jondotsoy.don-textmate)
with [`@vscode/vsce`](https://github.com/microsoft/vscode-vsce):

```sh
cd ide/textmate
bun install
bunx vsce package    # produces a .vsix locally, no publish
bunx vsce publish --pat "$VSCE_PAT"
```

`.github/workflows/publish-textmate.yml` automates this in CI:

- Runs on every push to `develop` that changes `ide/textmate/package.json`,
  and on-demand via `workflow_dispatch`.
- `workflow_dispatch` takes a `version_bump` input (`none` / `patch` /
  `minor` / `major`, like the root `publish.yml` workflow) to bump
  `ide/textmate/package.json`'s `version` and commit it before publishing.
- Skips publishing if a `textmate-v<version>` GitHub release already exists
  for the current version (so a re-run or an unrelated push doesn't
  re-publish).
- Validates the grammar (`scripts/validate-grammar.ts` +
  `vscode-tmgrammar-test`) before publishing.
- Requires the repository secret `VSCE_PAT` — a Personal Access Token from
  https://marketplace.visualstudio.com/manage, scoped to the `jondotsoy`
  publisher with Marketplace "Manage" access.
