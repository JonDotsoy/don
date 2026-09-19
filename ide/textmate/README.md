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
  against the actual `vscode-textmate` tokenizer.

## Validate

```sh
bun ide/textmate/scripts/validate-grammar.ts
```

Runs a lightweight structural check (valid JSON, every regex compiles, the
directive-name rule fires on the sample files) with no extra dependencies.

## Test against vscode-textmate

```sh
npm install -g vscode-tmgrammar-test
cd ide/textmate
vscode-tmgrammar-test 'tests/unit/**/*.test.don'
```

This tokenizes `tests/unit/basics.test.don` with the real `vscode-textmate`
engine (the same one VS Code uses) and checks the scopes assigned to
directive names, strings, numbers, booleans, `null`, comments, and block
braces against the `^`/`<-` assertions in the file. `package.json` in this
directory already declares the `don` language and grammar, so no `-g`/`-c`
flags are needed when run from `ide/textmate/`.

## Use in VS Code

Point VS Code at this directory as an unpacked extension (or copy it into
`~/.vscode/extensions/`) to get `.don`/`.donly` syntax highlighting.
