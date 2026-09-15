# donly

**donly** is the reference implementation of DON (Directive Object Notation), a human-readable data serialization format built around directives and subdirectives. DON was designed for writing infrastructure annotations — routes, containers, security rules, reverse proxies — in a shape that's fast for both humans and AI agents to read and generate. Instead of nesting keys and indentation levels to express a declaration, a directive takes its parameters as positional **arguments**, so a rule that needs a method, a path, and a body reads as one line instead of a tree:

```don
route GET /api {
  respond 200 "Ok"
}
```

The equivalent in a key-value format needs an extra level of nesting per parameter:

```yaml
routes:
  /api:
    GET:
      respond: 200 Ok
```

This matters more as the number of parameters grows — a container declaration with an image, a port mapping, and env vars stays one directive with a block, not a pyramid of nested maps. Because the shape is uniform (`name arg1 arg2 ... { children }`), an LLM reading or writing DON doesn't have to track indentation-sensitive nesting rules to know what a declaration means — it just reads the arguments in order.

Unlike DSLs tied to a single domain (an HTTP server config, a Dockerfile, an IaC tool), DON carries no built-in schema — it only defines the grammar for directives, arguments, and blocks. Directive names and their arguments are entirely up to you, so the same format can describe routes, containers, security rules, or any other domain-specific structure your project needs. See [`docs/refs/vs.md`](./docs/refs/vs.md) for a comparison against other DSLs.

## Features

- **Directive Arguments**: Directives take positional arguments (`route GET /api`), collapsing what would otherwise be several nested keys into one line
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

## Finding Directives

Every `Directive` has `find(path)` and `findAll(path)` to locate descendants by an absolute, `/`-separated path from that directive (treated as the document root), instead of walking `children` by hand:

```ts
import { DON } from "donly";

const root = DON.parse(`
server {
  route /home
  route GET /api/user
  route POST /api/user
}
`);

const home = root.find("/server/route(/home)");
// ? const home = Directive {
//   name: "route",
//   args: [ "/home" ],
//   children: [],
// }

const apiRoutes = root.findAll("/server/route(* /api/user)");
// ? const apiRoutes = [
//   Directive {
//     name: "route",
//     args: [ "GET", "/api/user" ],
//     children: [],
//   }, Directive {
//     name: "route",
//     args: [ "POST", "/api/user" ],
//     children: [],
//   }
// ]
```

The path syntax:

- `"/"` — the directive itself.
- `"/server"` — top-level children named `server`.
- `"/server/route"` — `route` children of a matched `server`.
- `"/server/route(/home)"` — `route` children whose args are exactly `["/home"]`.
- `"/server/route(* /api/user)"` — `route` children with any first argument and a second argument exactly `"/api/user"` (`*` wildcards a single argument; a directive only matches a `(...)` group when its `args.length` equals the number of space-separated patterns).
- `"/server/\/user"` — a `/user` child, i.e. a directive whose own name is `/user` (DON identifiers may contain `/`, see the [spec](./docs/specs/v1/spec.md#23-identifiers)); `\` escapes the character that follows it so it's read literally instead of as a path separator or a `(`/`)` group delimiter.
- `"/server/route{/auth(on)}"` — `route` children of `server` that have some descendant matching `/auth(on)`; the `{...}` group is a **filter** — it doesn't change what's returned, still the `route`, not the matched `auth`.
- `"/server/route{/auth}{/respond}"` and `"/server/route(GET)(text/*)"` — stacking `{...}`/`(...)` groups on one segment is an **AND**: every group must match.
- `"/server/route(GET|POST)"`, `"/server/route{/auth(on)|/auth(strict)}"`, `"/server/route|/server/proxy"` — `|` is an **OR**, between alternative values inside one token, alternative nested paths inside one `{...}` group, or alternative whole paths at the top level, respectively.

See [Path Expressions](./docs/concepts/path-expression.md) for the full syntax reference, including how these combine (and how the [lint rule schema](./docs/lint/rules.md) reuses the same matcher for its own `/name` sub-path keys).

`find` returns the first match (or `undefined`), `findAll` returns every match. `findDirective`/`findAllDirectives` are also exported from `donly/find` for the same lookup against any `Directive`, not just as instance methods.

`at(path)` resolves the same path syntax, but a path ending in `[N]` returns that directive's argument at position `N` instead of the directive itself. **Positions are 1-based** — `[1]` is the first argument:

```ts
const respond = root.at("/server/route(GET /api)/respond");
// ? const respond = Directive { name: "respond", args: [200], children: [] }

const status = root.at("/server/route(GET /api)/respond[1]");
// ? const status = 200
```

`atDirective` is also exported from `donly/find` for the same lookup against any `Directive`. `at`'s return type is narrowed for string-literal paths — see [TypeScript](#typescript).

## TypeScript

`donly` is written in TypeScript and ships its own `.d.ts` files — no `@types/donly` needed.

`Directive#at`/`atDirective` are generic over the path you pass them, so a string-literal path narrows the return type without a manual type assertion:

```ts
import { DON, type Directive } from "donly";

const root = DON.parse(`
server {
  route GET /api { respond 200 }
}
`);

// A path with no trailing "[N]" types as Directive | undefined.
const respond = root.at("/server/route(GET /api)/respond");
respond?.args; // Directive["args"]

// A path ending in "[N]" types as the argument value, not a Directive.
const status = root.at("/server/route(GET /api)/respond[1]");
//    ^? const status: string | number | boolean | HeredocValue | undefined

// @ts-expect-error a "[N]"-suffixed path never resolves to a Directive.
const notADirective: Directive = root.at("/server/route(GET /api)/respond[1]");
```

This only works when `path` is a string literal (or a literal type, e.g. from a `const` binding without a wider annotation) — TypeScript needs the exact string to check whether it ends in `[N]`. A path built at runtime (e.g. a `string` variable, or a template literal with a non-literal interpolation) can't be checked at compile time, so it types as the union of both possibilities:

```ts
declare const dynamicPath: string;

const value = root.at(dynamicPath);
//    ^? const value: string | number | boolean | HeredocValue | Directive | undefined
```

The conditional type behind this, `AtPathResult<P>`, is exported from `donly/find` if you need to reuse it (e.g. to type a helper that wraps `at`).

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

`donly/lint` runs a declarative `LintRuleDocument` against a DON document and
reports the issues found in it — a linter for your own directive schema,
authored as plain data instead of code, so rules can be written, stored, and
exchanged as JSON, YAML, or DON itself. See
[`docs/lint/rules.md`](./docs/lint/rules.md) for the full rule format.

```ts
import { lintSchema, type LintRuleDocument } from "donly/lint";

const rules: LintRuleDocument = {
  "/server/port": {
    "[1]": {
      type: "number",
      gt: 3000,
      lt: 60000,
      message: "port debe ser un número entre 3000 y 60000",
    },
  },
};

const issues = lintSchema(
  `
server {
  port "3000"
}
`,
  rules,
);

const summary = issues.map(({ message, severity }) => ({
  message,
  severity,
}));
// ? const summary = [
//   {
//     message: "port debe ser un número entre 3000 y 60000",
//     severity: "error",
//   }
// ]
```

`lintSchema(don, rules)` (also exported as `lint`) accepts a DON source
string and a `LintRuleDocument`, and returns every `LintIssue` the rules
report:

- `don: string` — the document to check
- `rules: LintRuleDocument` — a document keyed by directive path (e.g.
  `"/server/port"`), optionally fused with a 1-based argument selector (e.g.
  `"/server/port[1]"`). Each body may combine:
  - `required`/`min`/`max` — occurrence checks on the path
  - nested `"/child"` sub-paths, for validating deeper directives
  - `"[N]"` argument selectors, constraining the argument at that position
    by `type` (`"string" | "number" | "bigint" | "boolean" | "null" |
"heredoc"`), `enum`, `gt`/`gte`/`lt`/`lte` (numbers/bigints),
    `pattern`/`flags` (strings/heredocs), or the `or`/`and`/`not`
    combinators
  - an `evaluation` escape hatch for arbitrary custom logic, at the rule
    body or the individual argument level
  - `message`/`severity` (`"error" | "warning" | "info"`, default
    `"error"`), reported when the constraint fails

A `LintIssue` is:

- `message: string`
- `severity: "error" | "warning" | "info"`
- `loc?: LintLoc` — a `{ start, end }` pair of `Token`s spanning the
  offending directive or argument, when it comes from a document parsed by
  `DON.parse()`

`renderReport(issues, { filePath, asciiColor? })` and
`renderJSONReport(issues, { filePath })` turn a `LintIssue[]` into an
ESLint-style text report or a `JSONReport`, respectively — see
[`src/lint/report.ts`](./src/lint/report.ts).

### CLI

The package ships a `donly` executable — run it with `npx donly` or
`bunx donly` without installing anything first:

```sh
bunx donly lint --rules rules.json file.donly
```

`donly lint --rules <rules.json|rules.donly> <file>` reads a
`LintRuleDocument` from `rules.json` (or, given a `.donly`/`.don` path,
parses the same shape from DON syntax instead — see [Authoring rules in
DON syntax](./docs/lint/rules.md#authoring-rules-in-don-syntax-donly-rules-files)),
runs it against `file` with `lintSchema`, prints the result with
`renderReport`, and exits with a non-zero status code when any reported
issue is an `"error"`.

- `--output`/`-o` `default | json` — output format, defaults to `default`
  (the `renderReport` text report). `json` prints the `renderJSONReport`
  `JSONReport` instead:

  ```sh
  bunx donly lint --rules rules.json -o json file.donly
  ```

`donly inspect [--strategy|-s nested|tuple|raw] <file>` parses `file` with
`DON.parse` and prints it as JSON via `DirectiveJSONEncoder`, defaulting to
the `nested` strategy (`DirectiveJSONEncoder.nestedReducer` — the same shape
`load()` produces, args nested as object keys):

```sh
bunx donly inspect file.donly
```

- `--strategy`/`-s` `nested | tuple | raw` — defaults to `nested`.
  `tuple` uses `DirectiveJSONEncoder.tupleReducer` (args kept as an array);
  `raw` skips reducing altogether and prints the lossless
  `{ name, args, children }` shape.

## Demos

- [`donly/demo/http-proxy`](./src/demo/proxy/README.md) — a hot-reloading
  HTTP reverse proxy / mock server driven by a DON file: `server`/`route`
  directives with `respond`, `proxy_pass`, `header`, and
  `http1`/`http2`/`http3` + `ssl` settings, validated with `donly/lint` on
  every edit and served with [`Bun.serve()`](https://bun.sh/docs/api/http).

  ```ts
  import { serve } from "donly/demo/http-proxy";

  const server = await serve("./my-donly-server-file.donly");
  ```

## Development

This project uses [Bun](https://bun.sh):

```sh
bun install
bun test
bun run test:types
bun run lint
bun run build
```

## License

MIT
