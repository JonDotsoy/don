# DON: Directive Object Notation

DON is a human-readable data serialization format designed around the concept of directives and subdirectives. It combines the simplicity of declarative syntax with the flexibility of nested structures, allowing you to define hierarchical configurations using intuitive directive blocks. Each directive can accept arguments and contain nested subdirectives, making it ideal for configuration files, infrastructure definitions, and structured data representation where readability and expressiveness are priorities.

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
