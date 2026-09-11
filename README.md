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

Parse a DON document into an array of `Directive` objects:

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

const directives = DON.parse(text);

console.log(directives[0].name); // "name"
console.log(directives[0].args); // ["my-app"]

const database = directives.find((d) => d.name === "database");
console.log(database?.children.map((c) => [c.name, c.args]));
// [["host", ["localhost"]], ["port", [5432]]]
```

Each `Directive` has:

- `name: string` — the directive's identifier
- `args: (number | string | boolean)[]` — the directive's arguments
- `children: Directive[]` — nested subdirectives

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

const directives = DON.parse(`
server {
  host "localhost"
  port 8080
}
`);

const encoded = JSON.stringify(directives);
// ? const encoded = "[{\"server\":{\"host\":\"localhost\",\"port\":8080}}]"
```

Since `JSON.stringify` calls `toJSON()` on each array element independently, the result is one `{name: value}` object per top-level directive — it does not merge directives that share a name. For that (and for more control over the output shape — a lossless array form, or nesting args as object keys instead of `[...args, children]`), use `DirectiveJSONEncoder` directly:

```ts
import { DON, DirectiveJSONEncoder } from "donly";

const directives = DON.parse(`
server {
  host "localhost"
  port 8080
}
server {
  host "127.0.0.1"
  port 9090
}
`);

const encoded = DirectiveJSONEncoder.encode(directives);
// ? const encoded = { server: [{ host: "localhost", port: 8080 }, { host: "127.0.0.1", port: 9090 }] }
```

`DirectiveJSONEncoder.encode` returns a plain JS value (object or array), not a JSON string — pass it to `JSON.stringify` yourself if you need text. `DirectiveJSONDecoder` reverses this back into `Directive` instances, and likewise takes a plain JS value rather than a JSON string:

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
// ? const decoded = [
//   Directive {
//     name: "server",
//     args: [],
//     children: [
//       Directive {
//         name: "host",
//         args: [ "localhost" ],
//         children: [],
//       }, Directive {
//         name: "port",
//         args: [ 8080 ],
//         children: [],
//       }
//     ],
//   }
// ]
```

## XML Serialization

`DirectiveXMLEncoder` renders parsed directives as an HTML-like XML string. Args written as `key=value` become attributes, and any remaining args become the element's text content:

```ts
import { DON, DirectiveXMLEncoder } from "donly";

const directives = DON.parse(`
div x-data=name {
  span key=key1 hello
}
`);

const xml = DirectiveXMLEncoder.encode(directives);
// ? const xml = '<div x-data="name">\n  <span key="key1">hello</span>\n</div>'
```

An element with no children and no text is self-closed:

```ts
const directives = DON.parse("input name=email");

DirectiveXMLEncoder.encode(directives);
// ? "<input name=\"email\" />"
```

Pass `{ indent }` to change the indentation (defaults to two spaces):

```ts
DirectiveXMLEncoder.encode(directives, { indent: "    " });
```

`DirectiveXMLDecoder` reverses this back into `Directive` instances, parsing element attributes into `key=value` args and text content into a trailing string arg:

```ts
import { DirectiveXMLDecoder } from "donly";

const decoded = DirectiveXMLDecoder.decode(
  '<div x-data="name">\n  <span key="key1">hello</span>\n</div>',
);
// ? const decoded = [
//   Directive {
//     name: "div",
//     args: [ "x-data=name" ],
//     children: [
//       Directive {
//         name: "span",
//         args: [ "key=key1", "hello" ],
//         children: [],
//       }
//     ],
//   }
// ]
```

Both classes expose instance methods (`new DirectiveXMLEncoder().encode(...)`, `new DirectiveXMLDecoder().decode(...)`) in addition to the static `encode`/`decode` shortcuts shown above.

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
