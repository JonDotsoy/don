export const status: "Draft" | "Stable" | "Deprecated" = "Draft";
export const title = "DON Specification v1 - Directive Object Notation";
export const description = `\
Complete specification for DON v1, a human-readable data serialization format designed for configuration files, routers, and security rules. Learn syntax, directives, blocks, and examples.
`;
export const lang = "en";

mdLine`# DON Specification v1`;

tableOfContents();

mdLine`---`;

mdLine`## 1. Overview`;

mdLine`DON (Directive Object Notation) v1 is a human-readable data serialization format built around directives and subdirectives. This format is designed for configuration files such as security rules, routers, reverse proxies, and similar use cases.`;

mdLine`### Design Goals`;

mdLine`- **Minimal Syntax**: Reduce special characters to improve readability
- **Hierarchical Structure**: Support arbitrary nesting depth through blocks
- **Type Flexibility**: Support multiple primitive types (strings, numbers, booleans, null)
- **Multi-line Content**: Provide heredoc syntax for embedded content
- **Unambiguous Parsing**: Clear lexical and syntactic rules with no ambiguity`;

mdLine`## 1.1 DON vs JSON`;

mdLine`DON differs fundamentally from JSON in its approach to data representation. While JSON is a key-value structure designed for object serialization, DON uses a directive-based model that more closely resembles program execution with repeated function calls.`;

mdLine`### Conceptual Model`;

mdLine`In DON, a declaration like:`;

block({ key: "conceptual-model-don", lang: "don" })`
name "john"
`;

mdLine`Is conceptually equivalent to a function call in JavaScript:`;

block({ evalBlock: "conceptual-model-don", format: "js" });

mdLine`This directive-based approach allows for more flexible and expressive configurations compared to JSON's rigid object structure.`;

mdLine`### Structural Differences`;

mdLine`Consider a dependencies declaration:`;

mdLine`**DON**:`;

block({ key: "structural-differences-don", lang: "don" })`
dependencies {
  zod 4
  react 5
}
`;

mdLine`**Equivalent JavaScript representation**:`;

block({ evalBlock: "structural-differences-don", format: "js" });

mdLine`**JSON equivalent**:`;

block({ evalBlock: "structural-differences-don", format: "json" });

mdLine`While DON can be transformed into JSON-like structures, its directive model provides significant advantages for certain use cases.`;

mdLine`### Advantages for Configuration`;

mdLine`DON's directive-based structure excels in scenarios where repeated keys with different contexts are needed. This is particularly valuable for routing configurations and other domain-specific languages where key repetition is semantically meaningful.`;

mdLine`**Example: HTTP Router Configuration**`;

block({ key: "router-config-don", lang: "don" })`
server {
  router /users {
    respond 200 "Ok"
  }
  router /user/:user_id {
    respond 200 "Ok"
  }
  router /admin {
    respond 403 "Forbidden"
  }
}
`;

mdLine`In this example, the \`router\` directive is used multiple times with different arguments and nested configurations. This pattern is natural in DON but would require array structures or artificial key naming in JSON:`;

mdLine`**JSON equivalent (less intuitive)**:`;

block({ key: "router-config-json", lang: "json" })`
{
  "server": {
    "routers": [
      {
        "path": "/users",
        "response": { "status": 200, "body": "Ok" }
      },
      {
        "path": "/user/:user_id",
        "response": { "status": 200, "body": "Ok" }
      },
      {
        "path": "/admin",
        "response": { "status": 403, "body": "Forbidden" }
      }
    ]
  }
}
`;

mdLine`### Key Distinctions`;

mdLine`1. **Directive Repetition**: DON allows the same directive name to appear multiple times at the same level, each representing a distinct instruction. JSON requires unique keys or array structures.

2. **Semantic Clarity**: DON's syntax naturally expresses imperative configurations (commands and actions), while JSON is optimized for declarative data structures (state and properties).

3. **Reduced Verbosity**: DON eliminates the need for explicit key-value separators (\`:\`) and quotation marks around keys, resulting in cleaner configuration files.

4. **Positional Arguments**: DON directives support multiple positional arguments without requiring object wrapping, making simple declarations more concise.

5. **Domain-Specific Languages**: DON's structure is well-suited for building DSLs where the same operation (directive) needs to be invoked multiple times with different parameters, such as routing rules, middleware chains, or build steps.`;

mdLine`## 1.2 DON vs JSX`;

mdLine`### Can DON be used as an alternative to JSX rendering?`;

mdLine`Yes, DON can be used as an alternative to JSX rendering. However, its design is primarily focused on configuration files for security rules, routers, reverse proxies, and similar use cases rather than UI component rendering.`;

mdLine`**DON**:`;

block({ key: "jsx-comparison-don", lang: "don" })`
div x-data=name {
  span key=key1 hello
}
`;

mdLine`**JSX equivalent**:`;

block({ key: "jsx-comparison-jsx", lang: "jsx" })`
<div x-data="name">
  <span key="key1">hello</span>
</div>
`;

mdLine`---`;

mdLine`## 2. Syntax Elements`;

mdLine`### 2.1 Directives`;

mdLine`A directive is a named instruction with optional arguments.`;

mdLine`**Syntax**:`;

block({ key: "directive-syntax", lang: "don" })`
directive_name [arg1] [arg2] ... [argN]
`;

mdLine`**Examples**:`;

block({ key: "directive-examples", lang: "don" })`
name "my-app"
version "1.0.0"
port 8080
enabled true
route /api/users GET POST
`;

mdLine`**Directive Names**:

- Must be valid identifiers
- Tokenized as \`keyword\` tokens`;

mdLine`**Arguments**:

- Can be any valid token: keywords, strings, numbers, booleans, null
- Separated by whitespace`;

mdLine`### 2.2 Blocks`;

mdLine`Blocks group nested directives using curly braces.`;

mdLine`**Syntax**:`;

block({ key: "block-syntax", lang: "don" })`
directive_name {
  subdirective1
  subdirective2
}
`;

mdLine`**Delimiters**:

- Opening: \`{\`
- Closing: \`}\``;

mdLine`**Nesting**:`;

mdLine`Blocks can be nested to arbitrary depth:`;

block({ key: "block-nesting", lang: "don" })`
directive foo {
  directive2 taz lip {
    directive4
  }
  directive3 bob
}
`;

mdLine`**Whitespace Requirements**:

- Whitespace is **required** before \`{\`
- Whitespace is **required** after \`}\``;

mdLine`**Valid**:`;

block({ key: "block-whitespace-valid", lang: "don" })`
container { image "nginx" }
foo {
  bar
}
`;

mdLine`**Invalid**:`;

block({ key: "block-whitespace-invalid", lang: "don" })`
foo{bar}           # Error: missing whitespace before {
foo{ bar }         # Error: missing whitespace before {
foo { bar }tar     # Error: missing whitespace after }
`;

mdLine`**Constraint**:`;

mdLine`After a closing brace \`}\`, no additional tokens are allowed on the same directive line (except newlines).`;

mdLine`**Invalid**:`;

block({ key: "block-post-close-invalid", lang: "don" })`
container { image "nginx" } extra  # Error: tokens after block close
`;

mdLine`### 2.3 Identifiers`;

mdLine`Identifiers are alphanumeric tokens that name directives and serve as keywords.`;

mdLine`**Formation Rules**:

- Must start with an alphabetic character (\`a-z\`, \`A-Z\`), underscore (\`_\`), or special symbols
- May contain alphabetic characters, digits (\`0-9\`), underscores, and special symbols
- Special symbols include: \`$\`, \`-\`, \`/\`, \`:\`, \`[\`, \`]\`, and others
- Case-sensitive`;

mdLine`**Valid Examples**:`;

block({ key: "identifiers-valid", lang: "don" })`
foo
foo123
_private
myVariable
\${name}
/api/:name
[name]
my-[age]
path/to/resource
$prod
route-handler
`;

mdLine`**Lexical Behavior**:

- Identifiers are tokenized as \`keyword\` tokens
- Special characters are part of the keyword token when not separated by whitespace
- Whitespace is required to separate keywords from block delimiters (\`{\` and \`}\`)`;

mdLine`**Examples**:`;

block({ key: "identifiers-examples", lang: "don" })`
\${name} "value"           # Valid: keyword with special chars
/api/users GET            # Valid: path-like keyword
route-[id] {              # Valid: keyword with brackets
  handler "process"
}
`;

mdLine`### 2.4 Numbers`;

mdLine`DON v1 supports multiple numeric formats.`;

mdLine`#### Integer Literals`;

mdLine`Sequences of digits without decimal points.`;

block({ key: "numbers-integer", lang: "don" })`
123
-123
`;

mdLine`**Pattern**: \`[integer]\` or \`[-][integer]\``;

mdLine`#### Hexadecimal Literals`;

mdLine`Integers prefixed with \`0x\` or \`0X\`.`;

block({ key: "numbers-hex", lang: "don" })`
0xDEADB
0xFF
0xDEADBn  # BigInt variant
`;

mdLine`**Pattern**: \`0x[hexdigit]+\` or \`0X[hexdigit]+\`
**BigInt Pattern**: \`0x[hexdigit]+n\` or \`0X[hexdigit]+n\``;

mdLine`#### Octal Literals`;

mdLine`Integers prefixed with \`0o\` or \`0O\`.`;

block({ key: "numbers-octal", lang: "don" })`
0o755
0o644
0o755n  # BigInt variant
`;

mdLine`**Pattern**: \`0o[octaldigit]+\` or \`0O[octaldigit]+\`
**BigInt Pattern**: \`0o[octaldigit]+n\` or \`0O[octaldigit]+n\``;

mdLine`#### Binary Literals`;

mdLine`Integers prefixed with \`0b\` or \`0B\`.`;

block({ key: "numbers-binary", lang: "don" })`
0b1101
0b1010
0b1101n  # BigInt variant
`;

mdLine`**Pattern**: \`0b[binarydigit]+\` or \`0B[binarydigit]+\`
**BigInt Pattern**: \`0b[binarydigit]+n\` or \`0B[binarydigit]+n\``;

mdLine`#### Decimal Literals`;

mdLine`Numbers with decimal points.`;

block({ key: "numbers-decimal", lang: "don" })`
123.456
-123.123
`;

mdLine`**Pattern**: \`[integer][dot][integer]\` or \`[-][integer][dot][integer]\``;

mdLine`#### BigInt Literals`;

mdLine`Integers suffixed with \`n\`.`;

block({ key: "numbers-bigint", lang: "don" })`
123n
`;

mdLine`**Pattern**: \`[integer][alphabet('n')]\``;

mdLine`> **Why BigInt exists**: Standard integers have a maximum bit limit (typically 32 or 64 bits depending on the implementation), which restricts the range of representable values. BigInt provides support for arbitrarily large integers with much higher limits, enabling precise representation of very large numbers without overflow or precision loss.
>
> **Inspiration from JavaScript**: The BigInt syntax with the \`n\` suffix is inspired by JavaScript's BigInt implementation. Languages like Java, JavaScript, and Kotlin use two distinct data types to express numeric values (e.g., \`int\` and \`long\`, \`Number\` and \`BigInt\`). DON adopts this approach natively to avoid forcing programs to make distinctions between numeric types at runtime, which would complicate program logic and make the language more complex to work with.`;

mdLine`**Constraint**: The \`n\` suffix must immediately follow the integer with no additional characters.`;

mdLine`**Valid**:`;

block({ key: "numbers-bigint-valid", lang: "don" })`
123n
`;

mdLine`**Invalid**:`;

block({ key: "numbers-bigint-invalid", lang: "don" })`
123n1  # Trailing digits after 'n'
`;

mdLine`### 2.5 Strings`;

mdLine`String literals are delimited by single (\`'\`) or double (\`"\`) quotes.`;

mdLine`#### Double-Quoted Strings`;

block({ key: "strings-double-quoted", lang: "don" })`
"Hello world"
"Says: \\"Hello\\""
`;

mdLine`- Delimiter: \`"\`
- Escape sequence: \`\\"\` for literal quote character
- May contain spaces`;

mdLine`#### Single-Quoted Strings`;

block({ key: "strings-single-quoted", lang: "don" })`
'Hello world'
'It\\'s working'
`;

mdLine`- Delimiter: \`'\`
- Escape sequence: \`\\'\` for literal quote character
- May contain spaces`;

mdLine`#### Escape Sequences`;

mdLine`The backslash (\`\\\`) character escapes the delimiter within a string:

- \`\\"\` inside double-quoted strings
- \`\\'\` inside single-quoted strings`;

mdLine`**Example**:`;

block({ key: "strings-escape-example", lang: "don" })`
message "foo \\"tar\\""
path 'C:\\\\Users\\\\file.txt'
`;

mdLine`### 2.6 Booleans`;

mdLine`Boolean literals represent true/false values.`;

block({ key: "booleans-example", lang: "don" })`
true
false
`;

mdLine`- Tokenized as \`boolean\` tokens
- Case-sensitive (must be lowercase)`;

mdLine`### 2.7 Null`;

mdLine`The null literal represents absence of value.`;

block({ key: "null-example", lang: "don" })`
null
`;

mdLine`- Tokenized as a \`null\` token
- Case-sensitive (must be lowercase)`;

mdLine`### 2.8 Heredocs`;

mdLine`Heredocs provide syntax for multi-line content blocks with custom delimiters.`;

mdLine`**Syntax**:`;

block({ key: "heredoc-syntax", lang: "don" })`
directive <<<DELIMITER
  content line 1
  content line 2
`;

mdLine`**Rules**:

- Starts with \`<<<\` followed by a delimiter identifier (e.g., \`HTML\`, \`SCRIPT\`)
- Content begins on the next line
- Content must have greater indentation than the heredoc declaration
- Continues until a token with indentation equal to or less than the heredoc declaration line is found
- Tokenized as a \`heredoc\` token`;

mdLine`**Payload Determination**:`;

mdLine`The heredoc payload is determined by finding the smallest padding (indentation) among all content lines that is greater than the directive's indentation. This smallest padding is then removed from all lines to produce the final payload.`;

mdLine`> If you require more precise control over whitespace and indentation, we recommend using string literals instead.`;

mdLine`**Example 1**:`;

block({ key: "heredoc-example-1", lang: "don" })`
template <<<HTML
  <div>
    <h1>Hello</h1>
  </div>
`;

mdLine`The smallest padding greater than the directive indentation is 2 spaces. The payload becomes:`;

block({ key: "heredoc-example-1-output", lang: "html" })`
<div>
  <h1>Hello</h1>
</div>
`;

mdLine`**Example 2**:`;

block({ key: "heredoc-example-2", lang: "don" })`
template <<<
    foo
  tar
`;

mdLine`The smallest padding greater than the directive indentation is 2 spaces (from the \`tar\` line). The payload becomes:`;

block({ key: "heredoc-example-2-output", lang: "" })`
  foo
tar
`;

mdLine`**Example 3**:`;

block({ key: "heredoc-example-3", lang: "don" })`
server {
  response <<<HTML
    <html>
      <body>Content</body>
    </html>
  handler
}
`;

mdLine`**Nested in Blocks**:`;

block({ key: "heredoc-nested-in-blocks", lang: "don" })`
server {
  response <<<HTML
    <html>
      <body>Content</body>
    </html>
  handler
}
`;

mdLine`**Without Closing Delimiter**:`;

mdLine`If no token with equal or lesser indentation is found, the heredoc consumes all remaining content:`;

block({ key: "heredoc-without-closing-delimiter", lang: "don" })`
server {
  content <<<HTML
    div foo
    handler
}
`;

mdLine`In this case, \`div foo\` and \`handler\` are part of the heredoc content because they maintain greater indentation. The \`}\` closes the heredoc as it has lesser indentation.`;

mdLine`### 2.9 Comments`;

mdLine`DON supports two types of comments for documentation and annotations.`;

mdLine`#### Single-Line Comments`;

mdLine`Single-line comments start with \`#\` and continue until the end of the line.`;

block({ key: "comments-single-line", lang: "don" })`
# This is a comment
name "my-app"  # Inline comment
version "1.0.0"
`;

mdLine`- All text after \`#\` on the same line is ignored
- Can appear on their own line or after directives`;

mdLine`#### Multi-Line Comments`;

mdLine`Multi-line comments are delimited by \`/*\` and \`*/\`.`;

block({ key: "comments-multi-line", lang: "don" })`
/*
  This is a multi-line comment
  spanning multiple lines
*/
name "my-app"

server {
  /* Comment inside block */
  port 8080
}
`;

mdLine`- Start with \`/*\` and end with \`*/\`
- Can span multiple lines
- Can appear anywhere whitespace is allowed`;

mdLine`**Nesting**:`;

mdLine`Multi-line comments do not nest. The first \`*/\` closes the comment.`;

block({ key: "comments-nesting", lang: "don" })`
/* Outer comment /* inner */ still commented? */ name "app"
`;

mdLine`In this example, the comment closes at the first \`*/\`, and \`still commented? */ name "app"\` would be parsed as code.`;

mdLine`---`;

mdLine`## 3. Examples`;

mdLine`### 3.1 Simple Configuration`;

block({ key: "example-simple-configuration", lang: "don" })`
name "my-application"
version "1.0.0"
port 8080
enabled true
`;

mdLine`### 3.2 Nested Blocks`;

block({ key: "example-nested-blocks", lang: "don" })`
server {
  host "example.com"
  port 443

  route /api/* {
    handler "apiHandler"
    timeout 30
  }

  route /static/* {
    handler "staticHandler"
  }
}
`;

mdLine`### 3.3 Heredoc Content`;

block({ key: "example-heredoc-content", lang: "don" })`
template <<<HTML
  <!DOCTYPE html>
  <html>
    <head>
      <title>My Page</title>
    </head>
    <body>
      <h1>Welcome</h1>
    </body>
  </html>

script <<<BASH
  #!/bin/bash
  echo "Deploying..."
  npm run build
`;

mdLine`### 3.4 Complex Directive`;

block({ key: "example-complex-directive", lang: "don" })`
deployment $prod _internal path/\${name} {
  container {
    image "nginx:latest"
    port 80
    env {
      NODE_ENV "production"
      API_KEY "secret"
    }
  }

  replicas 3
  strategy "rolling"
}
`;

mdLine`### 3.5 Mixed Types`;

block({ key: "example-mixed-types", lang: "don" })`
config {
  name "app"
  version 2
  beta true
  deprecated null
  timeout 30.5
  maxSize 1024n
}
`;
