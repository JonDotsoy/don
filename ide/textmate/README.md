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

## Validate

```sh
bun ide/textmate/scripts/validate-grammar.ts
```

## Use in VS Code

Point VS Code at this directory as an unpacked extension (or copy it into
`~/.vscode/extensions/`) to get `.don`/`.donly` syntax highlighting.
