# DON: Directive Object Notation

DON is a human-readable data serialization format designed around the concept of directives and subdirectives. It combines the simplicity of declarative syntax with the flexibility of nested structures, allowing you to define hierarchical configurations using intuitive directive blocks. Each directive can accept arguments and contain nested subdirectives, making it ideal for configuration files, infrastructure definitions, and structured data representation where readability and expressiveness are priorities.

## Features

- **Minimal Syntax**: Fewer special characters, more readability
- **Sequential Processing**: Directives are processed as a pipeline, allowing overwriting and incremental composition
- **Flexible Nesting**: Supports hierarchies of any depth
- **Multiple Data Types**: Keywords, strings, numbers, booleans, and null
- **Heredoc Support**: Multi-line content blocks for embedded scripts and text
