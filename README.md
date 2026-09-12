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
```

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

## Linting

`donly/lint` validates a parsed document against your own rules — DON has no built-in schema, so every check (types, required fields, cardinality, ...) is a `LintRule` you write. A rule matches directives by a `/`-separated `path` of directive names and either validates each match independently (`validate`) or all matches sharing a parent together (`validateGroup`, e.g. to cap how many times a directive may appear). Both return `void` for a valid directive, or a `LintViolation` (`{ message?, severity? }`, each falling back to the rule's own `message` / `severity`, then `"error"`) to report one:

```ts
import { DON } from "donly";
import { lint, type LintRule } from "donly/lint";

const root = DON.parse(`
server {
  port "3000"
}
location /home {
  respond 200
  respond 404
}
location 404 {
  root "/var/www"
}
`);

const rules: LintRule[] = [
  {
    path: "/server/port",
    message: "port must be a number, not a string",
    validate: (directive) =>
      typeof directive.args[0] === "number" ? undefined : {},
  },
  {
    path: "/location",
    message: "location's path must be an absolute path starting with /",
    validate: (directive) =>
      typeof directive.args[0] === "string" && directive.args[0].startsWith("/")
        ? undefined
        : {},
  },
  {
    path: "/location",
    message: "a location block must have at least one respond declaration",
    validate: (directive) =>
      directive.children.some((child) => child.name === "respond")
        ? undefined
        : {},
  },
  {
    path: "/location/respond",
    message: "only one respond declaration is allowed per location block",
    validateGroup: (directives) => (directives.length <= 1 ? undefined : {}),
  },
];

const issues = lint(root, rules);
// ? const issues = [
//   LintIssue {
//     path: "/server/port",
//     message: "port must be a number, not a string",
//     severity: "error",
//     directive: Directive {
//       name: "port",
//       args: [ "3000" ],
//       children: [],
//     },
//     loc: {
//       start: {
//         offset: 12,
//         line: 2,
//         column: 2,
//         paddingLine: 2,
//       },
//       end: {
//         offset: 23,
//         line: 2,
//         column: 13,
//         paddingLine: 2,
//       },
//     },
//   }, LintIssue {
//     path: "/location",
//     message: "location's path must be an absolute path starting with /",
//     severity: "error",
//     directive: Directive {
//       name: "location",
//       args: [ 404 ],
//       children: [
//         Directive {
//           name: "root",
//           args: [ "/var/www" ],
//           children: [],
//         }
//       ],
//     },
//     loc: {
//       start: {
//         offset: 73,
//         line: 8,
//         column: 0,
//         paddingLine: 0,
//       },
//       end: {
//         offset: 85,
//         line: 8,
//         column: 12,
//         paddingLine: 0,
//       },
//     },
//   }, LintIssue {
//     path: "/location",
//     message: "a location block must have at least one respond declaration",
//     severity: "error",
//     directive: Directive {
//       name: "location",
//       args: [ 404 ],
//       children: [
//         Directive {
//           name: "root",
//           args: [ "/var/www" ],
//           children: [],
//         }
//       ],
//     },
//     loc: {
//       start: {
//         offset: 73,
//         line: 8,
//         column: 0,
//         paddingLine: 0,
//       },
//       end: {
//         offset: 85,
//         line: 8,
//         column: 12,
//         paddingLine: 0,
//       },
//     },
//   }, LintIssue {
//     path: "/location/respond",
//     message: "only one respond declaration is allowed per location block",
//     severity: "error",
//     directive: Directive {
//       name: "respond",
//       args: [ 200 ],
//       children: [],
//     },
//     loc: {
//       start: {
//         offset: 45,
//         line: 5,
//         column: 2,
//         paddingLine: 2,
//       },
//       end: {
//         offset: 56,
//         line: 5,
//         column: 13,
//         paddingLine: 2,
//       },
//     },
//   }
// ]
```

Each reported `LintIssue` carries the rule's `path`, `message`, `severity` (`"error"` by default), the offending `directive`, and its `loc` — the directive's own declaration (its name and args, e.g. `location 404`, not the block through its children) as `{ start, end }` points, each a `{ offset, line, column, paddingLine }` — so a consumer (a CLI, an editor integration) can point straight at the failing line and column:

<!-- before-block
import { DON } from "donly";
import { lint, type LintRule } from "donly/lint";

const root = DON.parse(`
server {
  port "3000"
}
location /home {
  respond 200
  respond 404
}
location 404 {
  root "/var/www"
}
`);

const rules: LintRule[] = [
  {
    path: "/server/port",
    message: "port must be a number, not a string",
    validate: (directive) => (typeof directive.args[0] === "number" ? undefined : {}),
  },
  {
    path: "/location",
    message: "location's path must be an absolute path starting with /",
    validate: (directive) =>
      typeof directive.args[0] === "string" && directive.args[0].startsWith("/")
        ? undefined
        : {},
  },
  {
    path: "/location",
    message: "a location block must have at least one respond declaration",
    validate: (directive) =>
      directive.children.some((child) => child.name === "respond") ? undefined : {},
  },
  {
    path: "/location/respond",
    message: "only one respond declaration is allowed per location block",
    validateGroup: (directives) => (directives.length <= 1 ? undefined : {}),
  },
];

const issues = lint(root, rules);
-->

```ts
const report = issues.map(
  (issue) =>
    `${issue.severity} ${issue.loc?.start.line}:${issue.loc?.start.column} ${issue.message} (${issue.path})`,
);
// ? const report = [ "error 2:2 port must be a number, not a string (/server/port)", "error 8:0 location's path must be an absolute path starting with / (/location)",
//   "error 8:0 a location block must have at least one respond declaration (/location)",
//   "error 5:2 only one respond declaration is allowed per location block (/location/respond)"
// ]
```

`findByPath(root, path)` and `findGroupsByPath(root, path)` — the same path resolution `lint()` uses internally — are also exported, for building custom checks directly on top of the matched directives.

A violation only needs to carry what it wants to override — a bare `{}` (or, for `validateGroup`, any object) falls all the way back to the rule's `message` and `severity`; a single rule can also return a different message per failure kind, since the check that decides validity is the one that decides what to say about it:

<!-- before-block
import { DON } from "donly";
import { lint, type LintRule } from "donly/lint";

const root = DON.parse(`
product {
  price "9.99"
}
`);

const productIsWellFormedRule: LintRule = {
  path: "/product",
  validate: (directive) => {
    const price = directive.children.find((child) => child.name === "price")?.args[0];
    if (typeof price !== "number") return { message: "price must be a number" };
    if (price <= 0) return { message: "price must be positive", severity: "warning" };
  },
};

const issues = lint(root, [productIsWellFormedRule]);
-->

```ts
const messages = issues.map((issue) => `${issue.severity}: ${issue.message}`);
// ? const messages = [ "error: price must be a number" ]
```

`validate` and `validateGroup` only ever see directives sharing one name (a single match, or every match under one parent) — a check spanning _different_ directive names, like a declaration order, points `path` at their common parent and reads `directive.children` directly:

```ts
import { DON } from "donly";
import { lint, type LintRule } from "donly/lint";

// `order` references products by sku, so a product declared after (or with
// no order at all before it) the order that depends on it is invalid.
const productsBeforeOrdersRule: LintRule = {
  path: "/cart",
  message: "every product must be declared before any order that references it",
  validate: (directive) => {
    const firstOrderIndex = directive.children.findIndex(
      (child) => child.name === "order",
    );
    if (firstOrderIndex === -1) return undefined;
    const hasProductAfterOrder = directive.children
      .slice(firstOrderIndex + 1)
      .some((child) => child.name === "product");
    return hasProductAfterOrder ? {} : undefined;
  },
};

const root = DON.parse(`
cart {
  product {
    sku "KB-100"
    name "Keyboard"
  }
  order {
    item "KB-100"
  }
  product {
    sku "MS-200"
    name "Mouse"
  }
}
`);

const issues = lint(root, [productsBeforeOrdersRule]);
// ? const issues = [
//   LintIssue {
//     path: "/cart",
//     message: "every product must be declared before any order that references it",
//     severity: "error",
//     directive: Directive {
//       name: "cart",
//       args: [],
//       children: [
//         Directive {
//           name: "product",
//           args: [],
//           children: [
//             Directive {
//               name: "sku",
//               args: [ "KB-100" ],
//               children: [],
//             }, Directive {
//               name: "name",
//               args: [ "Keyboard" ],
//               children: [],
//             }
//           ],
//         }, Directive {
//           name: "order",
//           args: [],
//           children: [
//             Directive {
//               name: "item",
//               args: [ "KB-100" ],
//               children: [],
//             }
//           ],
//         }, Directive {
//           name: "product",
//           args: [],
//           children: [
//             Directive {
//               name: "sku",
//               args: [ "MS-200" ],
//               children: [],
//             }, Directive {
//               name: "name",
//               args: [ "Mouse" ],
//               children: [],
//             }
//           ],
//         }
//       ],
//     },
//     loc: {
//       start: {
//         offset: 1,
//         line: 1,
//         column: 0,
//         paddingLine: 0,
//       },
//       end: {
//         offset: 5,
//         line: 1,
//         column: 4,
//         paddingLine: 0,
//       },
//     },
//   }
// ]
```

`path` itself is optional — omit it and the rule runs against _every_ directive in the document, at any depth, instead of one specific shape:

```ts
import { DON } from "donly";
import { lint, type LintRule } from "donly/lint";

// No `path`: this scans every directive, wherever it is, for a leftover
// placeholder — not tied to one directive name or nesting level.
const noTodoPlaceholderRule: LintRule = {
  message: "arguments must not contain a leftover TODO placeholder",
  validate: (directive) =>
    directive.args.some(
      (arg) => typeof arg === "string" && arg.includes("TODO"),
    )
      ? {}
      : undefined,
};

const root = DON.parse(`
cart {
  product {
    name "Keyboard"
    description "TODO: write a real description"
  }
}
`);

const issues = lint(root, [noTodoPlaceholderRule]);
// ? const issues = [
//   LintIssue {
//     path: undefined,
//     message: "arguments must not contain a leftover TODO placeholder",
//     severity: "error",
//     directive: Directive {
//       name: "description",
//       args: [ "TODO: write a real description" ],
//       children: [],
//     },
//     loc: {
//       start: {
//         offset: 44,
//         line: 4,
//         column: 4,
//         paddingLine: 4,
//       },
//       end: {
//         offset: 88,
//         line: 4,
//         column: 48,
//         paddingLine: 4,
//       },
//     },
//   }
// ]
```

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
