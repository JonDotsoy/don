# DON: Directive Object Notation

DON is a human-readable data serialization format designed around the concept of directives and subdirectives. It combines the simplicity of declarative syntax with the flexibility of nested structures, allowing you to define hierarchical configurations using intuitive directive blocks. Each directive can accept arguments and contain nested subdirectives, making it ideal for configuration files, infrastructure definitions, and structured data representation where readability and expressiveness are priorities.

## Features

- **Minimal Syntax**: Fewer special characters, more readability
- **Sequential Processing**: Directives are processed as a pipeline, allowing overwriting and incremental composition
- **Flexible Nesting**: Supports hierarchies of any depth
- **Multiple Data Types**: Keywords, strings, numbers, booleans, and null
- **Heredoc Support**: Multi-line content blocks for embedded scripts and text
- **Comments**: Supports line comments (`//`, `#`) and multi-line comments (`/* */`)
- **Unambiguous**: Clear parsing rules and delimitation

## Installation

### Using npm

```bash
npm install @jondotsoy/don
```

### Using Bun

```bash
bun add @jondotsoy/don
```

## Usage

### Deserialization (DON → JavaScript)

Parse DON format strings into JavaScript objects using `DocumentDecoder`:

```typescript
import { DocumentDecoder } from "@jondotsoy/don";

const donPayload = `
name "my-app"
version "1.0.0"
container {
  image "nginx"
  port 8080
}
`;

const decoder = new DocumentDecoder();
const result = decoder.decode(donPayload);

console.log(result);
// Output: { name: "my-app", version: "1.0.0", container: { image: "nginx", port: 8080 } }
```

### Serialization (JavaScript → DON)

Convert JavaScript objects into DON format strings using `DocumentEncoder`:

```typescript
import { DocumentEncoder } from "@jondotsoy/don";

const data = {
  name: "my-app",
  version: "1.0.0",
  container: {
    image: "nginx",
    port: 8080,
  },
};

const encoder = new DocumentEncoder();
const donString = encoder.encode(data);

console.log(donString);
// Output:
// name "my-app"
// version "1.0.0"
// container {
//   image "nginx"
//   port 8080
// }
```

### Working with Heredocs

```typescript
import { DocumentDecoder } from "@jondotsoy/don";

const donPayload = `
name "deployment-script"
script <<<
  #!/bin/bash
  echo "Deploying application..."
  npm run build
`;

const result = new DocumentDecoder().decode(donPayload);

console.log(result.script);
// Output: "#!/bin/bash\necho \"Deploying application...\"\nnpm run build"
```

## Documentation

For more information about DON, check out the [complete documentation](./docs/index.md):

- [DON File Format](./docs/don-file.md): Complete format specification
- [Formal Specification v0](./docs/specs/v0/spec.md): Draft specification (v0)
- [Directives](./docs/concepts/directive.md): Anatomy and usage of directives
- [Heredocs](./docs/concepts/heredoc.md): Multi-line content blocks
- [Data Types](./docs/concepts/types/): Specification of supported types
- [Inspiration](./docs/inspiration.md): Project goals and vision

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
