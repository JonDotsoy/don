---
title: DON Specification v1 - Directive Object Notation
description: Complete specification for DON v1, a human-readable data serialization format designed for configuration files, routers, and security rules. Learn syntax, directives, blocks, and examples.
lang: en
---

# DON Specification v1

> **Status**: Draft

## Table of Contents

1. [Overview](#1-overview)
   - [Design Goals](#design-goals)
   - [DON vs JSON](#11-don-vs-json)
   - [DON vs JSX](#12-don-vs-jsx)
2. [Syntax Elements](#2-syntax-elements)
   - [Directives](#21-directives)
   - [Blocks](#22-blocks)
   - [Identifiers](#23-identifiers)
   - [Numbers](#24-numbers)
   - [Strings](#25-strings)
   - [Booleans](#26-booleans)
   - [Null](#27-null)
   - [Heredocs](#28-heredocs)
   - [Comments](#29-comments)
3. [Examples](#3-examples)
   - [Simple Configuration](#31-simple-configuration)
   - [Nested Blocks](#32-nested-blocks)
   - [Heredoc Content](#33-heredoc-content)
   - [Complex Directive](#34-complex-directive)
   - [Mixed Types](#35-mixed-types)

---

## 1. Overview

DON (Directive Object Notation) v1 is a human-readable data serialization format built around directives and subdirectives. This format is designed for configuration files such as security rules, routers, reverse proxies, and similar use cases.

### Design Goals

- **Minimal Syntax**: Reduce special characters to improve readability
- **Hierarchical Structure**: Support arbitrary nesting depth through blocks
- **Type Flexibility**: Support multiple primitive types (strings, numbers, booleans, null)
- **Multi-line Content**: Provide heredoc syntax for embedded content
- **Unambiguous Parsing**: Clear lexical and syntactic rules with no ambiguity

## 1.1 DON vs JSON

DON differs fundamentally from JSON in its approach to data representation. While JSON is a key-value structure designed for object serialization, DON uses a directive-based model that more closely resembles program execution with repeated function calls.

### Conceptual Model

In DON, a declaration like:

```don
name "john"
```

Is conceptually equivalent to a function call in JavaScript:

```ts
import { Directive } from "donly";

const directive = new Directive("name", ["john"], []);
// ? const directive = Directive {
//   name: "name",
//   args: [ "john" ],
//   children: [],
// }
```

This directive-based approach allows for more flexible and expressive configurations compared to JSON's rigid object structure.

### Structural Differences

Consider a dependencies declaration:

**DON**:

```don
dependencies {
  zod 4
  react 5
}
```

**Equivalent JavaScript representation**:

```ts
import { Directive } from "donly";

const directive = new Directive("dependencies", [], [
  new Directive("zod", [4], []),
  new Directive("react", [5], []),
]);
// ? const directive = Directive {
//   name: "dependencies",
//   args: [],
//   children: [
//     Directive {
//       name: "zod",
//       args: [ 4 ],
//       children: [],
//     }, Directive {
//       name: "react",
//       args: [ 5 ],
//       children: [],
//     }
//   ],
// }
```

**JSON equivalent**:

<!-- before-block-eval
import { DON, DirectiveJSONEncoder } from "donly";

const directives = DON.parse(`
dependencies {
  zod 4
  react 5
}
`);

const result = JSON.parse(DirectiveJSONEncoder.encode(directives));
-->

```json
{
  "dependencies": {
    "zod": 4,
    "react": 5
  }
}
```

While DON can be transformed into JSON-like structures, its directive model provides significant advantages for certain use cases.

### Advantages for Configuration

DON's directive-based structure excels in scenarios where repeated keys with different contexts are needed. This is particularly valuable for routing configurations and other domain-specific languages where key repetition is semantically meaningful.

**Example: HTTP Router Configuration**

```don
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
```

<!-- before-block-eval
import { DON, DirectiveJSONEncoder } from "donly";

const directives = DON.parse(`
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
`);

const result = JSON.parse(
  DirectiveJSONEncoder.encode(directives, { reducer: DirectiveJSONEncoder.nestedReducer }),
);
-->

```json
{
  "server": {
    "router": [
      {
        "/users": {
          "respond": {
            "200": "Ok"
          }
        }
      },
      {
        "/user/:user_id": {
          "respond": {
            "200": "Ok"
          }
        }
      },
      {
        "/admin": {
          "respond": {
            "403": "Forbidden"
          }
        }
      }
    ]
  }
}
```

In this example, the `router` directive is used multiple times with different arguments and nested configurations. This pattern is natural in DON but would require array structures or artificial key naming in JSON:

**JSON equivalent (less intuitive)**:

```ts
import { DON, DirectiveJSONEncoder } from "donly";

const directives = DON.parse(`
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
`);

const encoded = JSON.parse(
  DirectiveJSONEncoder.encode(directives, { reducer: DirectiveJSONEncoder.nestedReducer }),
);
// ? const encoded = {
//   server: {
//     router: [
//       {
//         "/users": {
//           respond: {
//             "200": "Ok",
//           },
//         },
//       }, {
//         "/user/:user_id": {
//           respond: {
//             "200": "Ok",
//           },
//         },
//       }, {
//         "/admin": {
//           respond: {
//             "403": "Forbidden",
//           },
//         },
//       }
//     ],
//   },
// }
```

### Key Distinctions

1. **Directive Repetition**: DON allows the same directive name to appear multiple times at the same level, each representing a distinct instruction. JSON requires unique keys or array structures.

2. **Semantic Clarity**: DON's syntax naturally expresses imperative configurations (commands and actions), while JSON is optimized for declarative data structures (state and properties).

3. **Reduced Verbosity**: DON eliminates the need for explicit key-value separators (`:`) and quotation marks around keys, resulting in cleaner configuration files.

4. **Positional Arguments**: DON directives support multiple positional arguments without requiring object wrapping, making simple declarations more concise.

5. **Domain-Specific Languages**: DON's structure is well-suited for building DSLs where the same operation (directive) needs to be invoked multiple times with different parameters, such as routing rules, middleware chains, or build steps.

## 1.2 DON vs JSX

### Can DON be used as an alternative to JSX rendering?

Yes, DON can be used as an alternative to JSX rendering. However, its design is primarily focused on configuration files for security rules, routers, reverse proxies, and similar use cases rather than UI component rendering.

**DON**:

```don
div x-data=name {
  span key=key1 hello
}
```

<!-- before-block-eval
import { DON } from "donly";

const result = DON.parse(`
div x-data=name {
  span key=key1 hello
}
`);
-->

```js
[
  Directive {
    name: "div",
    args: [ "x-data=name" ],
    children: [
      Directive {
        name: "span",
        args: [ "key=key1", "hello" ],
        children: [],
      }
    ],
  }
]
```

**JSX equivalent**:

```jsx
<div x-data="name">
  <span key="key1">hello</span>
</div>
```

---

## 2. Syntax Elements

### 2.1 Directives

A directive is a named instruction with optional arguments.

**Syntax**:

```don
directive_name [arg1] [arg2] ... [argN]
```

**Examples**:

```don
name "my-app"
version "1.0.0"
port 8080
enabled true
route /api/users GET POST
```

<!-- before-block-eval
import { DON } from "donly";

const result = DON.parse(`
name "my-app"
version "1.0.0"
port 8080
enabled true
route /api/users GET POST
`);
-->

```js
[
  Directive {
    name: "name",
    args: [ "my-app" ],
    children: [],
  }, Directive {
    name: "version",
    args: [ "1.0.0" ],
    children: [],
  }, Directive {
    name: "port",
    args: [ 8080 ],
    children: [],
  }, Directive {
    name: "enabled",
    args: [ true ],
    children: [],
  }, Directive {
    name: "route",
    args: [ "/api/users", "GET", "POST" ],
    children: [],
  }
]
```

**Directive Names**:

- Must be valid identifiers
- Tokenized as `keyword` tokens

**Arguments**:

- Can be any valid token: keywords, strings, numbers, booleans, null
- Separated by whitespace

### 2.2 Blocks

Blocks group nested directives using curly braces.

**Syntax**:

```don
directive_name {
  subdirective1
  subdirective2
}
```

<!-- before-block-eval
import { DON } from "donly";

const result = DON.parse(`
directive_name {
  subdirective1
  subdirective2
}
`);
-->

```js
[
  Directive {
    name: "directive_name",
    args: [],
    children: [
      Directive {
        name: "subdirective1",
        args: [],
        children: [],
      }, Directive {
        name: "subdirective2",
        args: [],
        children: [],
      }
    ],
  }
]
```

**Delimiters**:

- Opening: `{`
- Closing: `}`

**Nesting**:

Blocks can be nested to arbitrary depth:

```don
directive foo {
  directive2 taz lip {
    directive4
  }
  directive3 bob
}
```

<!-- before-block-eval
import { DON } from "donly";

const result = DON.parse(`
directive foo {
  directive2 taz lip {
    directive4
  }
  directive3 bob
}
`);
-->

```js
[
  Directive {
    name: "directive",
    args: [ "foo" ],
    children: [
      Directive {
        name: "directive2",
        args: [ "taz", "lip" ],
        children: [
          Directive {
            name: "directive4",
            args: [],
            children: [],
          }
        ],
      }, Directive {
        name: "directive3",
        args: [ "bob" ],
        children: [],
      }
    ],
  }
]
```

**Whitespace Requirements**:

- Whitespace is **required** before `{`
- Whitespace is **required** after `}`

**Valid**:

```don
container { image "nginx" }
foo {
  bar
}
```

<!-- before-block-eval
import { DON } from "donly";

const result = DON.parse(`
container { image "nginx" }
foo {
  bar
}
`);
-->

```js
[
  Directive {
    name: "container",
    args: [],
    children: [
      Directive {
        name: "image",
        args: [ "nginx" ],
        children: [],
      }
    ],
  }, Directive {
    name: "foo",
    args: [],
    children: [
      Directive {
        name: "bar",
        args: [],
        children: [],
      }
    ],
  }
]
```

**Invalid**:

```don
foo{bar}           # Error: missing whitespace before {
foo{ bar }         # Error: missing whitespace before {
foo { bar }tar     # Error: missing whitespace after }
```

**Constraint**:

After a closing brace `}`, no additional tokens are allowed on the same directive line (except newlines).

**Invalid**:

```don
container { image "nginx" } extra  # Error: tokens after block close
```

### 2.3 Identifiers

Identifiers are alphanumeric tokens that name directives and serve as keywords.

**Formation Rules**:

- Must start with an alphabetic character (`a-z`, `A-Z`), underscore (`_`), or special symbols
- May contain alphabetic characters, digits (`0-9`), underscores, and special symbols
- Special symbols include: `$`, `-`, `/`, `:`, `[`, `]`, and others
- Case-sensitive

**Valid Examples**:

```don
foo
foo123
_private
myVariable
${name}
/api/:name
[name]
my-[age]
path/to/resource
$prod
route-handler
```

<!-- before-block-eval
import { DON } from "donly";

const result = DON.parse(`
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
`);
-->

```js
[
  Directive {
    name: "foo",
    args: [],
    children: [],
  }, Directive {
    name: "foo123",
    args: [],
    children: [],
  }, Directive {
    name: "_private",
    args: [],
    children: [],
  }, Directive {
    name: "myVariable",
    args: [],
    children: [],
  }, Directive {
    name: "${name}",
    args: [],
    children: [],
  }, Directive {
    name: "/api/:name",
    args: [],
    children: [],
  }, Directive {
    name: "[name]",
    args: [],
    children: [],
  }, Directive {
    name: "my-[age]",
    args: [],
    children: [],
  }, Directive {
    name: "path/to/resource",
    args: [],
    children: [],
  }, Directive {
    name: "$prod",
    args: [],
    children: [],
  }, Directive {
    name: "route-handler",
    args: [],
    children: [],
  }
]
```

**Lexical Behavior**:

- Identifiers are tokenized as `keyword` tokens
- Special characters are part of the keyword token when not separated by whitespace
- Whitespace is required to separate keywords from block delimiters (`{` and `}`)

**Examples**:

```don
${name} "value"           # Valid: keyword with special chars
/api/users GET            # Valid: path-like keyword
route-[id] {              # Valid: keyword with brackets
  handler "process"
}
```

<!-- before-block-eval
import { DON } from "donly";

const result = DON.parse(`
\${name} "value"           # Valid: keyword with special chars
/api/users GET            # Valid: path-like keyword
route-[id] {              # Valid: keyword with brackets
  handler "process"
}
`);
-->

```js
[
  Directive {
    name: "${name}",
    args: [ "value" ],
    children: [],
  }, Directive {
    name: "/api/users",
    args: [ "GET" ],
    children: [],
  }, Directive {
    name: "route-[id]",
    args: [],
    children: [
      Directive {
        name: "handler",
        args: [ "process" ],
        children: [],
      }
    ],
  }
]
```

### 2.4 Numbers

DON v1 supports multiple numeric formats.

#### Integer Literals

Sequences of digits without decimal points.

```don
123
-123
```

**Pattern**: `[integer]` or `[-][integer]`

#### Hexadecimal Literals

Integers prefixed with `0x` or `0X`.

```don
0xDEADB
0xFF
0xDEADBn  # BigInt variant
```

**Pattern**: `0x[hexdigit]+` or `0X[hexdigit]+`
**BigInt Pattern**: `0x[hexdigit]+n` or `0X[hexdigit]+n`

#### Octal Literals

Integers prefixed with `0o` or `0O`.

```don
0o755
0o644
0o755n  # BigInt variant
```

**Pattern**: `0o[octaldigit]+` or `0O[octaldigit]+`
**BigInt Pattern**: `0o[octaldigit]+n` or `0O[octaldigit]+n`

#### Binary Literals

Integers prefixed with `0b` or `0B`.

```don
0b1101
0b1010
0b1101n  # BigInt variant
```

**Pattern**: `0b[binarydigit]+` or `0B[binarydigit]+`
**BigInt Pattern**: `0b[binarydigit]+n` or `0B[binarydigit]+n`

#### Decimal Literals

Numbers with decimal points.

```don
123.456
-123.123
```

**Pattern**: `[integer][dot][integer]` or `[-][integer][dot][integer]`

#### BigInt Literals

Integers suffixed with `n`.

```don
123n
```

**Pattern**: `[integer][alphabet('n')]`

> **Why BigInt exists**: Standard integers have a maximum bit limit (typically 32 or 64 bits depending on the implementation), which restricts the range of representable values. BigInt provides support for arbitrarily large integers with much higher limits, enabling precise representation of very large numbers without overflow or precision loss.
>
> **Inspiration from JavaScript**: The BigInt syntax with the `n` suffix is inspired by JavaScript's BigInt implementation. Languages like Java, JavaScript, and Kotlin use two distinct data types to express numeric values (e.g., `int` and `long`, `Number` and `BigInt`). DON adopts this approach natively to avoid forcing programs to make distinctions between numeric types at runtime, which would complicate program logic and make the language more complex to work with.

**Constraint**: The `n` suffix must immediately follow the integer with no additional characters.

**Valid**:

```don
123n
```

**Invalid**:

```don
123n1  # Trailing digits after 'n'
```

### 2.5 Strings

String literals are delimited by single (`'`) or double (`"`) quotes.

#### Double-Quoted Strings

```don
"Hello world"
"Says: \"Hello\""
```

- Delimiter: `"`
- Escape sequence: `\"` for literal quote character
- May contain spaces

#### Single-Quoted Strings

```don
'Hello world'
'It\'s working'
```

- Delimiter: `'`
- Escape sequence: `\'` for literal quote character
- May contain spaces

#### Escape Sequences

The backslash (`\`) character escapes the delimiter within a string:

- `\"` inside double-quoted strings
- `\'` inside single-quoted strings

**Example**:

```don
message "foo \"tar\""
path 'C:\\Users\\file.txt'
```

<!-- before-block-eval
import { DON } from "donly";

const result = DON.parse(`
message "foo \\"tar\\""
path 'C:\\\\Users\\\\file.txt'
`);
-->

```js
[
  Directive {
    name: "message",
    args: [ "foo \\\"tar\\\"" ],
    children: [],
  }, Directive {
    name: "path",
    args: [ "C:\\\\Users\\\\file.txt" ],
    children: [],
  }
]
```

### 2.6 Booleans

Boolean literals represent true/false values.

```don
true
false
```

- Tokenized as `boolean` tokens
- Case-sensitive (must be lowercase)

### 2.7 Null

The null literal represents absence of value.

```don
null
```

- Tokenized as a `null` token
- Case-sensitive (must be lowercase)

### 2.8 Heredocs

Heredocs provide syntax for multi-line content blocks with custom delimiters.

**Syntax**:

```don
directive <<<DELIMITER
  content line 1
  content line 2
```

**Rules**:

- Starts with `<<<` followed by a delimiter identifier (e.g., `HTML`, `SCRIPT`)
- Content begins on the next line
- Content must have greater indentation than the heredoc declaration
- Continues until a token with indentation equal to or less than the heredoc declaration line is found
- Tokenized as a `heredoc` token

**Payload Determination**:

The heredoc payload is determined by finding the smallest padding (indentation) among all content lines that is greater than the directive's indentation. This smallest padding is then removed from all lines to produce the final payload.

> If you require more precise control over whitespace and indentation, we recommend using string literals instead.

**Example 1**:

```don
template <<<HTML
  <div>
    <h1>Hello</h1>
  </div>
```

<!-- before-block-eval
import { DON } from "donly";

const result = DON.parse(`
template <<<HTML
  <div>
    <h1>Hello</h1>
  </div>
`);
-->

```js
[
  Directive {
    name: "template",
    args: [],
    children: [],
  }
]
```

The smallest padding greater than the directive indentation is 2 spaces. The payload becomes:

```html
<div>
  <h1>Hello</h1>
</div>
```

**Example 2**:

```don
template <<<
    foo
  tar
```

<!-- before-block-eval
import { DON } from "donly";

const result = DON.parse(`
template <<<
    foo
  tar
`);
-->

```js
[
  Directive {
    name: "template",
    args: [],
    children: [],
  }
]
```

The smallest padding greater than the directive indentation is 2 spaces (from the `tar` line). The payload becomes:

```
  foo
tar
```

**Example 3**:

```don
server {
  response <<<HTML
    <html>
      <body>Content</body>
    </html>
  handler
}
```

<!-- before-block-eval
import { DON } from "donly";

const result = DON.parse(`
server {
  response <<<HTML
    <html>
      <body>Content</body>
    </html>
  handler
}
`);
-->

```js
[
  Directive {
    name: "server",
    args: [],
    children: [
      Directive {
        name: "response",
        args: [ "handler" ],
        children: [],
      }
    ],
  }
]
```

**Nested in Blocks**:

```don
server {
  response <<<HTML
    <html>
      <body>Content</body>
    </html>
  handler
}
```

**Without Closing Delimiter**:

If no token with equal or lesser indentation is found, the heredoc consumes all remaining content:

```don
server {
  content <<<HTML
    div foo
    handler
}
```

<!-- before-block-eval
import { DON } from "donly";

const result = DON.parse(`
server {
  content <<<HTML
    div foo
    handler
}
`);
-->

```js
[
  Directive {
    name: "server",
    args: [],
    children: [
      Directive {
        name: "content",
        args: [],
        children: [],
      }
    ],
  }
]
```

In this case, `div foo` and `handler` are part of the heredoc content because they maintain greater indentation. The `}` closes the heredoc as it has lesser indentation.

### 2.9 Comments

DON supports two types of comments for documentation and annotations.

#### Single-Line Comments

Single-line comments start with `#` and continue until the end of the line.

```don
# This is a comment
name "my-app"  # Inline comment
version "1.0.0"
```

<!-- before-block-eval
import { DON } from "donly";

const result = DON.parse(`
# This is a comment
name "my-app"  # Inline comment
version "1.0.0"
`);
-->

```js
[
  Directive {
    name: "name",
    args: [ "my-app" ],
    children: [],
  }, Directive {
    name: "version",
    args: [ "1.0.0" ],
    children: [],
  }
]
```

- All text after `#` on the same line is ignored
- Can appear on their own line or after directives

#### Multi-Line Comments

Multi-line comments are delimited by `/*` and `*/`.

```don
/*
  This is a multi-line comment
  spanning multiple lines
*/
name "my-app"

server {
  /* Comment inside block */
  port 8080
}
```

<!-- before-block-eval
import { DON } from "donly";

const result = DON.parse(`
/*
  This is a multi-line comment
  spanning multiple lines
*/
name "my-app"

server {
  /* Comment inside block */
  port 8080
}
`);
-->

```js
[
  Directive {
    name: "name",
    args: [ "my-app" ],
    children: [],
  }, Directive {
    name: "server",
    args: [],
    children: [
      Directive {
        name: "port",
        args: [ 8080 ],
        children: [],
      }
    ],
  }
]
```

- Start with `/*` and end with `*/`
- Can span multiple lines
- Can appear anywhere whitespace is allowed

**Nesting**:

Multi-line comments do not nest. The first `*/` closes the comment.

```don
/* Outer comment /* inner */ still commented? */ name "app"
```

<!-- before-block-eval
import { DON } from "donly";

const result = DON.parse(`
/* Outer comment /* inner */ still commented? */ name "app"
`);
-->

```js
[
  Directive {
    name: "still",
    args: [ "commented?", "*/", "name", "app" ],
    children: [],
  }
]
```

In this example, the comment closes at the first `*/`, and `still commented? */ name "app"` would be parsed as code.

---

## 3. Examples

### 3.1 Simple Configuration

```don
name "my-application"
version "1.0.0"
port 8080
enabled true
```

<!-- before-block-eval
import { DON } from "donly";

const result = DON.parse(`
name "my-application"
version "1.0.0"
port 8080
enabled true
`);
-->

```js
[
  Directive {
    name: "name",
    args: [ "my-application" ],
    children: [],
  }, Directive {
    name: "version",
    args: [ "1.0.0" ],
    children: [],
  }, Directive {
    name: "port",
    args: [ 8080 ],
    children: [],
  }, Directive {
    name: "enabled",
    args: [ true ],
    children: [],
  }
]
```

### 3.2 Nested Blocks

```don
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
```

<!-- before-block-eval
import { DON } from "donly";

const result = DON.parse(`
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
`);
-->

```js
[
  Directive {
    name: "server",
    args: [],
    children: [
      Directive {
        name: "host",
        args: [ "example.com" ],
        children: [],
      }, Directive {
        name: "port",
        args: [ 443 ],
        children: [],
      }, Directive {
        name: "route",
        args: [ "/api/*" ],
        children: [
          Directive {
            name: "handler",
            args: [ "apiHandler" ],
            children: [],
          }, Directive {
            name: "timeout",
            args: [ 30 ],
            children: [],
          }
        ],
      }, Directive {
        name: "route",
        args: [ "/static/*" ],
        children: [
          Directive {
            name: "handler",
            args: [ "staticHandler" ],
            children: [],
          }
        ],
      }
    ],
  }
]
```

### 3.3 Heredoc Content

```don
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
```

<!-- before-block-eval
import { DON } from "donly";

const result = DON.parse(`
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
`);
-->

```js
[
  Directive {
    name: "template",
    args: [ "script" ],
    children: [],
  }
]
```

### 3.4 Complex Directive

```don
deployment $prod _internal path/${name} {
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
```

<!-- before-block-eval
import { DON } from "donly";

const result = DON.parse(`
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
`);
-->

```js
[
  Directive {
    name: "deployment",
    args: [ "$prod", "_internal", "path/${name}" ],
    children: [
      Directive {
        name: "container",
        args: [],
        children: [
          Directive {
            name: "image",
            args: [ "nginx:latest" ],
            children: [],
          }, Directive {
            name: "port",
            args: [ 80 ],
            children: [],
          }, Directive {
            name: "env",
            args: [],
            children: [
              Directive {
                name: "NODE_ENV",
                args: [ "production" ],
                children: [],
              }, Directive {
                name: "API_KEY",
                args: [ "secret" ],
                children: [],
              }
            ],
          }
        ],
      }, Directive {
        name: "replicas",
        args: [ 3 ],
        children: [],
      }, Directive {
        name: "strategy",
        args: [ "rolling" ],
        children: [],
      }
    ],
  }
]
```

### 3.5 Mixed Types

```don
config {
  name "app"
  version 2
  beta true
  deprecated null
  timeout 30.5
  maxSize 1024n
}
```

<!-- before-block-eval
import { DON } from "donly";

const result = DON.parse(`
config {
  name "app"
  version 2
  beta true
  deprecated null
  timeout 30.5
  maxSize 1024n
}
`);
-->

```js
[
  Directive {
    name: "config",
    args: [],
    children: [
      Directive {
        name: "name",
        args: [ "app" ],
        children: [],
      }, Directive {
        name: "version",
        args: [ 2 ],
        children: [],
      }, Directive {
        name: "beta",
        args: [ true ],
        children: [],
      }, Directive {
        name: "deprecated",
        args: [ "null" ],
        children: [],
      }, Directive {
        name: "timeout",
        args: [ 30.5 ],
        children: [],
      }, Directive {
        name: "maxSize",
        args: [ 1024n ],
        children: [],
      }
    ],
  }
]
```
