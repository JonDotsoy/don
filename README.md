# donly

**donly** is the reference implementation of DON (Directive Object Notation), a human-readable data serialization format designed around the concept of directives and subdirectives. It combines the simplicity of declarative syntax with the flexibility of nested structures, allowing you to define hierarchical configurations using intuitive directive blocks. Each directive can accept arguments and contain nested subdirectives, making it ideal for configuration files, infrastructure definitions, and structured data representation where readability and expressiveness are priorities.

## Features

- **Minimal Syntax**: Fewer special characters, more readability
- **Sequential Processing**: Directives are processed as a pipeline, allowing overwriting and incremental composition
- **Flexible Nesting**: Supports hierarchies of any depth
- **Multiple Data Types**: Keywords, strings, numbers, booleans, and null
- **Comments**: Line (`#`) and block (`/* ... */`) comments
- **Heredoc Support**: Multi-line content blocks for embedded scripts and text

## Installation

```sh
npm install donly
```

```sh
bun add donly
```

## Usage

Parse a DON document into a `Directive`:

```ts
import { DON } from "donly";

const text = `
name "my-app"
port 8080

database {
  host "localhost"
  port 5432
}
`;

const root = DON.parse(text);

const database = root.children.find((d) => d.name === "database");
const result = database?.children.map((c) => [c.name, c.args]);
// ? const result = [
//   [ "host", [ "localhost" ] ], [ "port", [ 5432 ] ]
// ]
```

Each `Directive` has:

- `name: string | symbol` — the directive's identifier
- `args: (number | string | boolean)[]` — the directive's arguments
- `children: Directive[]` — nested subdirectives

`DON.parse()` always returns a single `Directive`:

- **No top-level directives** (empty input, or only comments) → an empty
  root `Directive` (`name: ROOT_DIRECTIVE_NAME`, `children: []`).
- **Exactly one** top-level directive → that `Directive` itself, unwrapped
  (e.g. `DON.parse('host "localhost"')` → `Directive{name:"host", args:["localhost"]}`).
- **Two or more** top-level directives → wrapped in a synthetic root
  `Directive` (`name: ROOT_DIRECTIVE_NAME`) with them as `children`, as in
  the example above.

`ROOT_DIRECTIVE_NAME` is exported from `donly` — check `directive.name === ROOT_DIRECTIVE_NAME` to detect a synthetic root.

## AST

`DON.parse()` compiles the source text into a lexer/syntax tree internally, then hands you back a plain tree of `Directive` nodes — this `Directive` tree **is** the AST that `donly` exposes publicly. There is no separate "AST" type to import: every directive in the document, from the root down to the deepest subdirective, is a `Directive` instance, and traversing `children` recursively walks the whole tree.

For the example in [Usage](#usage):

```
Directive (name: ROOT_DIRECTIVE_NAME)          # synthetic root, 2+ top-level directives
├── Directive (name: "name", args: ["my-app"])
├── Directive (name: "port", args: [8080])
└── Directive (name: "database", args: [])
    ├── Directive (name: "host", args: ["localhost"])
    └── Directive (name: "port", args: [5432])
```

Each node carries just three fields, with no parent pointer or source-position data:

- `name: string | symbol` — the directive's identifier (or `ROOT_DIRECTIVE_NAME` for a synthetic root)
- `args: (number | string | boolean | HeredocValue)[]` — the directive's arguments, already decoded to JS values
- `children: Directive[]` — nested subdirectives, in source order

Because the shape is uniform (every node, root or leaf, is a `Directive`), you can write a single recursive function to walk it:

```ts
import { DON, type Directive } from "donly";

function walk(node: Directive, depth = 0): string[] {
  const line = `${"  ".repeat(depth)}${String(node.name)} ${JSON.stringify(node.args)}`;
  return [line, ...node.children.flatMap((child) => walk(child, depth + 1))];
}

const text = `
name "my-app"
port 8080

database {
  host "localhost"
  port 5432
}
`;

const lines = walk(DON.parse(text)).join("\n");
// ? const lines = "Symbol(root) []\n  name [\"my-app\"]\n  port [8080]\n  database []\n    host [\"localhost\"]\n    port [5432]"
```

A `Directive`'s own fields never include its source `Token`s or `span` — that data is dropped while building the tree so the public shape stays plain and JSON-serializable. When a `Directive` comes from `DON.parse()`, though, its name and args `Token`s are still reachable via `Directive.tokensByDirective()`, keyed by the `Directive` instance itself:

```ts
import { DON, Directive } from "donly";

const root = DON.parse('host "localhost"');
const tokens = Directive.tokensByDirective(root)?.map((token) => token.raw());
// ? const tokens = [ "host", "\"localhost\"" ]

const [token] = Directive.tokensByDirective(root) ?? [];
// ? const token = Token {
//   type: 11,
//   parts: [
//     Part {
//       type: 1,
//       buffer: [ 104, 111, 115, 116 ],
//       span: Span {
//         index: 0,
//         length: 4,
//         startLocation: {
//           line: 0,
//           column: 0,
//           paddingLine: 0,
//         },
//         endLocation: {
//           line: 0,
//           column: 4,
//           paddingLine: 0,
//         },
//       },
//       id: 0,
//       toUint8Array: [Function: toUint8Array],
//       toText: [Function: toText],
//       toJSON: [Function: toJSON],
//     }
//   ],
//   span: Span {
//     index: 0,
//     length: 4,
//     startLocation: {
//       line: 0,
//       column: 0,
//       paddingLine: 0,
//     },
//     endLocation: {
//       line: 0,
//       column: 4,
//       paddingLine: 0,
//     },
//   },
//   describeError: [Function: describeError],
//   getErrors: [Function: getErrors],
//   arrayBuffer: [Function: arrayBuffer],
//   text: [Function: text],
//   raw: [Function: raw],
//   toJS: [Function: toJS],
//   json: [Function: json],
//   toJSON: [Function: toJSON],
// }
```

`token.type` and `part.type` are numeric `SyntaxKind` values — the enum `LexerParser` and the syntax parser tag every scanned unit with:

```ts
import { SyntaxKind as kindsyntax } from "donly";
// ? const kindsyntax = {
//   "0": "unknown",
//   "1": "alphabet",
//   "2": "integer",
//   "3": "whitespace",
//   "4": "newline",
//   "5": "dot",
//   "6": "underscore",
//   "7": "singleQuote",
//   "8": "doubleQuote",
//   "9": "openCurlyBrace",
//   "10": "closeCurlyBrace",
//   "11": "keyword",
//   "12": "string",
//   "13": "numeric",
//   "14": "boolean",
//   "15": "null",
//   "16": "comment",
//   "17": "indent",
//   "18": "heredoc",
//   unknown: 0,
//   alphabet: 1,
//   integer: 2,
//   whitespace: 3,
//   newline: 4,
//   dot: 5,
//   underscore: 6,
//   singleQuote: 7,
//   doubleQuote: 8,
//   openCurlyBrace: 9,
//   closeCurlyBrace: 10,
//   keyword: 11,
//   string: 12,
//   numeric: 13,
//   boolean: 14,
//   null: 15,
//   comment: 16,
//   indent: 17,
//   heredoc: 18,
// }
```

| Value | Name              | Description                                                                                           |
| ----- | ----------------- | ----------------------------------------------------------------------------------------------------- |
| 0     | `unknown`         | Fallback kind for input the lexer couldn't classify into anything below.                              |
| 1     | `alphabet`        | A letter, while scanning a bare word (an identifier, keyword, or the `true`/`false`/`null` literals). |
| 2     | `integer`         | A digit, while scanning a number literal.                                                             |
| 3     | `whitespace`      | A space or tab between tokens.                                                                        |
| 4     | `newline`         | A line break, which separates directives from each other.                                             |
| 5     | `dot`             | The `.` character, joining the integer parts of a decimal number.                                     |
| 6     | `underscore`      | The `_` character, allowed inside identifiers.                                                        |
| 7     | `singleQuote`     | The `'` character opening/closing a quoted string.                                                    |
| 8     | `doubleQuote`     | The `"` character opening/closing a quoted string.                                                    |
| 9     | `openCurlyBrace`  | The `{` character, opening a block of nested subdirectives.                                           |
| 10    | `closeCurlyBrace` | The `}` character, closing a block of nested subdirectives.                                           |
| 11    | `keyword`         | A resolved directive name or bare-word argument token.                                                |
| 12    | `string`          | A resolved quoted-string argument token.                                                              |
| 13    | `numeric`         | A resolved number argument token.                                                                     |
| 14    | `boolean`         | A resolved `true`/`false` argument token.                                                             |
| 15    | `null`            | A resolved `null` argument token.                                                                     |
| 16    | `comment`         | A line (`#`) or block (`/* ... */`) comment token.                                                    |
| 17    | `indent`          | Leading whitespace on a line, recognized as indentation.                                              |
| 18    | `heredoc`         | A heredoc block token (multi-line content between `<<` markers).                                      |

`SyntaxKind` is exported from `donly`, but its numeric values are considered internal — treat them as opaque unless you're working at the lexer/syntax-parser level.

`tokensByDirective(directive)` returns `undefined` for a `Directive` not produced by the parser — one you built by hand with `new Directive(...)`, or one that came out of `DirectiveJSONDecoder`.

If you need lower-level access to the parse — spans, source locations, or the full token stream including directives you don't hold a reference to — `SyntaxEncode` (the syntax parser) and `LexerParser` (the lexer, documented below) are also exported from `donly`, but they are considered internal/advanced APIs: `Directive` is the supported way to consume a parsed document.

## Lexer (`LexerParser`)

`LexerParser` is the first stage of the pipeline behind `DON.parse()`: it turns raw source (text or bytes) into a flat list of `Token`s, before the syntax parser groups those tokens into the `Directive` tree described above. Reach for it directly only when you need the tokens themselves — e.g. building a syntax highlighter, a linter, or inspecting exactly how a piece of source was scanned.

```ts
import { LexerParser } from "donly";

const { tokens } = new LexerParser().parse('host "localhost"');
const summary = tokens.map((token) => [token.type, token.text()]);
// ? const summary = [
//   [ 11, "host" ], [ 12, "localhost" ]
// ]
```

`new LexerParser(options?)` takes:

- `debug?: boolean` — also emit "invisible" tokens (whitespace, newlines, comments) that are dropped by default, so the token list mirrors the source exactly
- `allowDebugDocument?: boolean` — retain the original input alongside the result, retrievable via `Lexema.debugGetDocument()`

`parse(input: string | Uint8Array | Iterable<number> | PartSet)` accepts source as text or bytes and returns a `Lexema`, whose only public member is `tokens: Token[]`.

Each `Token` exposes:

- `type: SyntaxKind` — the token kind (`keyword`, `string`, `numeric`, `boolean`, `null`, `heredoc`, `comment`, `openCurlyBrace`, `closeCurlyBrace`, …)
- `text()` — the decoded value (e.g. a quoted string's contents without the surrounding quotes)
- `raw()` — the exact source slice the token was scanned from, quotes and all
- `toJS()` — the token's value already coerced to a JS type (`number`/`bigint` for `numeric`, `boolean` for `boolean`, `null` for `null`, a `HeredocValue` for `heredoc`), the same conversion `DON.parse()` uses to build a `Directive`'s `args`
- `span` — the token's position (byte offset, length, start/end line & column) in the source

By default, whitespace, newlines, and comments are scanned but discarded (`invisible` tokens); pass `{ debug: true }` to keep them, which is how the internal `donToParts` helper reproduces the full token stream for snapshot tests.

## Example

```don
# Application configuration
name "my-app"
describe "A simple package manager for Node.js projects"

dependencies {
  zod ">=1"
  react ">=5"
}

server {
  host "0.0.0.0"
  port 8080 # Listen port
  ssl true
}
```

See [`docs/specs/v1/spec.md`](./docs/specs/v1/spec.md) for the full language specification.

## JSON Serialization

`Directive` implements `toJSON()`, so passing a parsed document straight to `JSON.stringify` produces a readable JSON representation instead of dumping the raw `{name, args, children}` instance fields:

```ts
import { DON } from "donly";

const directive = DON.parse(`
server {
  host "localhost"
  port 8080
}
`);

const encoded = JSON.stringify(directive);
// ? const encoded = "{\"server\":{\"host\":\"localhost\",\"port\":8080}}"
```

For multiple top-level directives, `DON.parse()` returns a synthetic root — `JSON.stringify` on it merges each top-level directive into one object, keyed by name (it does not merge directives that share a name; see `DirectiveJSONEncoder` below for that). For more control over the output shape (a lossless array form, or nesting args as object keys instead of `[...args, children]`), use `DirectiveJSONEncoder` directly — it accepts a single `Directive` or a `Directive[]`, so pass a `DON.parse()` result straight through (a synthetic root's `children` are merged the same way `JSON.stringify` merges them):

```ts
import { DON, DirectiveJSONEncoder } from "donly";

const root = DON.parse(`
server {
  host "localhost"
  port 8080
}
server {
  host "127.0.0.1"
  port 9090
}
`);

const encoded = DirectiveJSONEncoder.encode(root);
// ? const encoded = {
//   server: [
//     {
//       host: "localhost",
//       port: 8080,
//     }, {
//       host: "127.0.0.1",
//       port: 9090,
//     }
//   ],
// }
```

`DirectiveJSONEncoder.encode` returns a plain JS value (object or array), not a JSON string — pass it to `JSON.stringify` yourself if you need text. `DirectiveJSONDecoder` reverses this back into a `Directive` (following the same single/wrapped-root rule as `DON.parse()`), and likewise takes a plain JS value rather than a JSON string — so `decoder.decode(encoder.encode(x))` round-trips back to (a deep-equal copy of) `x`:

```ts
import { DON, DirectiveJSONDecoder, DirectiveJSONEncoder } from "donly";

const encoded = DirectiveJSONEncoder.encode(
  DON.parse(`
server {
  host "localhost"
  port 8080
}
`),
);

const decoded = new DirectiveJSONDecoder().decode(encoded);
// ? const decoded = Directive {
//   name: "server",
//   args: [],
//   children: [
//     Directive {
//       name: "host",
//       args: [ "localhost" ],
//       children: [],
//     }, Directive {
//       name: "port",
//       args: [ 8080 ],
//       children: [],
//     }
//   ],
// }
```

## Lint

`donly/lint` runs custom rules against a DON document and reports issues found
in it — a linter for your own directive schema.

```ts
import { lint, argumentLoc, type LintRule } from "donly/lint";

const portMustBeNumber: LintRule = {
  path: "/server/port",
  evaluation({ directive }) {
    const value = directive.args[0];
    if (typeof value === "number") return [];

    return [
      {
        message: "port debe ser un número, no un string",
        severity: "error",
        loc: argumentLoc(directive, 0),
      },
    ];
  },
};

const issues = lint('server {\n  port "3000"\n}\n', [portMustBeNumber], {
  payload: "nginx.donly",
});
// ? const issues = [
//   {
//     message: "port debe ser un número, no un string",
//     severity: "error",
//     trace: "nginx.donly:2:8",
//   }
// ]
```

`lint(input, rules, options?)` accepts a DON source string or an already
parsed `Directive`, plus a list of `LintRule`s, and returns every `LintIssue`
their `evaluation`s report:

- `input: string | Directive` — the document to check
- `rules: LintRule[]` — the rules to run against it
- `options.payload?: string` — source name shown in a reported issue's
  `trace` (e.g. a file path); defaults to `"<input>"`

A `LintRule` has:

- `path?: string` — an absolute, `/`-separated chain of directive names from
  the document root (e.g. `"/server/location"`). `evaluation` runs once for
  every directive whose own name, preceded by its ancestors' names up to the
  root, matches this chain exactly. Omitting `path` runs `evaluation` once
  against the document root instead.
- `evaluation: (context: LintContext) => Iterable<LintIssue>` — inspects the
  matched directive and returns any issues found; an array works, and so
  does a generator function that `yield`s each issue as it finds it:

  ```ts
  const everyArgMustBeString: LintRule = {
    path: "/tags",
    *evaluation({ directive }) {
      for (const [index, value] of directive.args.entries()) {
        if (typeof value === "string") continue;

        yield {
          message: `el argumento ${index} debe ser un string`,
          severity: "error",
          loc: argumentLoc(directive, index),
        };
      }
    },
  };
  ```

`LintContext` gives the rule:

- `directive: Directive` — the directive the rule matched
- `parent: Directive | null` — the matched directive's parent, or `null` at
  the document root
- `namePath: string[]` — real directive names from the document root down to
  `directive`

A `LintIssue` is:

- `message: string`
- `severity: "error" | "warning" | "info"`
- `trace?: string` — filled in from `loc.start` when the rule didn't set one
  itself
- `loc?: LintLoc` — a `{ start, end }` pair of `Token`s

Two helpers build a `LintLoc` from a directive parsed by `DON.parse()`:

- `directiveLoc(directive)` — spans the directive's own name and args (not
  its children's)
- `argumentLoc(directive, startIndex, endIndex?)` — spans one positional
  argument, or a range of them when `endIndex` is given

Both return `undefined` for a directive with no backing tokens (e.g. one
built by hand with `new Directive(...)`) or, for `argumentLoc`, an
out-of-range index.

## Development

This project uses [Bun](https://bun.sh):

```sh
bun install
bun test
bun run lint
bun run build
```

## License

MIT
