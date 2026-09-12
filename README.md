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
function walk(node: Directive, depth = 0): void {
  console.log("  ".repeat(depth) + String(node.name), node.args);
  for (const child of node.children) walk(child, depth + 1);
}

walk(DON.parse(text));
```

If you need lower-level access to the parse — tokens, spans, or source locations — `SyntaxEncode` (the syntax parser) and `LexerParser` (the lexer) are also exported from `donly`, but they are considered internal/advanced APIs: `Directive` is the supported way to consume a parsed document.

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
