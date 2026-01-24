# DON Specification v1

> **Status**: Draft

## Table of Contents

1. [Overview](#1-overview)
   - [Design Goals](#11-design-goals)
   - [Architecture](#12-architecture)
2. [Lexical Analysis](#2-lexical-analysis)
   - [Character Classification](#21-character-classification)
   - [Parts and PartSet](#22-parts-and-partset)
   - [Tokens and Lexemes](#23-tokens-and-lexemes)
3. [Syntax Elements](#3-syntax-elements)
   - [Identifiers](#31-identifiers)
   - [Numbers](#32-numbers)
   - [Strings](#33-strings)
   - [Booleans](#34-booleans)
   - [Null](#35-null)
   - [Heredocs](#36-heredocs)
   - [Directives](#37-directives)
   - [Blocks](#38-blocks)
4. [Encoding Pipeline](#4-encoding-pipeline)
   - [PartSet Encoding](#41-partset-encoding)
   - [Lexema Encoding](#42-lexema-encoding)
   - [Syntax Encoding](#43-syntax-encoding)
5. [Whitespace and Formatting](#5-whitespace-and-formatting)
6. [Examples](#6-examples)

---

## 1. Overview

DON (Directive Object Notation) v1 is a human-readable data serialization format built around directives and subdirectives. This specification defines the lexical structure, syntax rules, and encoding pipeline for parsing DON documents into structured representations.

### 1.1 Design Goals

- **Minimal Syntax**: Reduce special characters to improve readability
- **Hierarchical Structure**: Support arbitrary nesting depth through blocks
- **Type Flexibility**: Support multiple primitive types (strings, numbers, booleans, null)
- **Multi-line Content**: Provide heredoc syntax for embedded content
- **Unambiguous Parsing**: Clear lexical and syntactic rules with no ambiguity

### 1.2 Architecture

The DON v1 compiler follows a three-stage pipeline:

```
Input Text → PartSet → Lexema → Syntax AST
```

1. **PartSet Encoding**: Scans raw bytes and classifies characters into parts based on syntax kind
2. **Lexema Encoding**: Groups parts into tokens and constructs a lexeme stream
3. **Syntax Encoding**: Builds an Abstract Syntax Tree (AST) from tokens

---

## 2. Lexical Analysis

### 2.1 Character Classification

The lexer classifies each character into one of the following syntax kinds:

| Syntax Kind       | Description              | Examples       |
| ----------------- | ------------------------ | -------------- |
| `alphabet`        | Alphabetic characters    | `a-z`, `A-Z`   |
| `integer`         | Numeric digits           | `0-9`          |
| `whitespace`      | Space and tab characters | ` `, `\t`      |
| `newline`         | Line terminators         | `\n`, `\r\n`   |
| `dot`             | Decimal point            | `.`            |
| `underscore`      | Underscore character     | `_`            |
| `singleQuote`     | Single quote delimiter   | `'`            |
| `doubleQuote`     | Double quote delimiter   | `"`            |
| `openCurlyBrace`  | Block opening delimiter  | `{`            |
| `closeCurlyBrace` | Block closing delimiter  | `}`            |
| `unknown`         | Unrecognized characters  | `$`, `/`, etc. |

### 2.2 Parts and PartSet

A **Part** represents a contiguous sequence of characters with the same syntax kind. The lexer scans input and produces a **PartSet**, which is an ordered collection of parts.

**Example**:

```don
foo 123
```

This produces a PartSet with the following parts:

1. `alphabet` part: `foo`
2. `whitespace` part: ` `
3. `integer` part: `123`

### 2.3 Tokens and Lexemes

The lexer groups parts into **tokens** based on semantic meaning. A **Lexema** is the complete stream of tokens produced from a PartSet.

**Token Types**:

- `keyword`: Identifiers and directive names
- `string`: Quoted string literals
- `numeric`: Number literals (integer, decimal, bigint)
- `boolean`: Boolean literals (`true`, `false`)
- `null`: Null literal
- `heredoc`: Multi-line heredoc content
- `whitespace`: Whitespace (when debug mode enabled)
- `newline`: Newlines (when debug mode enabled)
- `indent`: Indentation (when debug mode enabled)

---

## 3. Syntax Elements

### 3.1 Identifiers

Identifiers are alphanumeric tokens that name directives and serve as keywords.

**Formation Rules**:

- Must start with an alphabetic character (`a-z`, `A-Z`) or underscore (`_`)
- May contain alphabetic characters, digits (`0-9`), and underscores
- Case-sensitive

**Valid Examples**:

```don
foo
foo123
_private
myVariable
```

**Invalid Examples**:

```don
123invalid  # Cannot start with digit
my-var      # Hyphen not allowed
```

**Lexical Behavior**:

- Identifiers are tokenized as `keyword` tokens
- Adjacent to delimiters without whitespace: `foo{` produces two tokens: `keyword("foo")` and `openCurlyBrace`
- Special characters like `$` are classified as `unknown` and produce separate tokens

### 3.2 Numbers

DON v1 supports multiple numeric formats.

#### 3.2.1 Integer Literals

Sequences of digits without decimal points.

```don
123
-123
```

**Pattern**: `[integer]` or `[-][integer]`

#### 3.2.2 Decimal Literals

Numbers with decimal points.

```don
123.456
-123.123
```

**Pattern**: `[integer][dot][integer]` or `[-][integer][dot][integer]`

#### 3.2.3 BigInt Literals

Integers suffixed with `n`.

```don
123n
```

**Pattern**: `[integer][alphabet('n')]`

**Constraint**: The `n` suffix must immediately follow the integer with no additional characters.

**Valid**:

```don
123n
```

**Invalid**:

```don
123n1  # Trailing digits after 'n'
```

### 3.3 Strings

String literals are delimited by single (`'`) or double (`"`) quotes.

#### 3.3.1 Double-Quoted Strings

```don
"Hello world"
"Says: \"Hello\""
```

- Delimiter: `"`
- Escape sequence: `\"` for literal quote character
- May contain spaces

#### 3.3.2 Single-Quoted Strings

```don
'Hello world'
'It\'s working'
```

- Delimiter: `'`
- Escape sequence: `\'` for literal quote character
- May contain spaces

#### 3.3.3 Escape Sequences

The backslash (`\`) character escapes the delimiter within a string:

- `\"` inside double-quoted strings
- `\'` inside single-quoted strings

**Example**:

```don
message "foo \"tar\""
path 'C:\\Users\\file.txt'
```

### 3.4 Booleans

Boolean literals represent true/false values.

```don
true
false
```

- Tokenized as `boolean` tokens
- Case-sensitive (must be lowercase)

### 3.5 Null

The null literal represents absence of value.

```don
null
```

- Tokenized as a `null` token
- Case-sensitive (must be lowercase)

### 3.6 Heredocs

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

**Example**:

```don
template <<<HTML
  <div>
    <h1>Hello</h1>
  </div>
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

In this case, `div foo` and `handler` are part of the heredoc content because they maintain greater indentation. The `}` closes the heredoc as it has lesser indentation.

### 3.7 Directives

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
```

**Directive Names**:

- Must be valid identifiers
- Tokenized as `keyword` tokens

**Arguments**:

- Can be any valid token: keywords, strings, numbers, booleans, null
- Separated by whitespace

### 3.8 Blocks

Blocks group nested directives using curly braces.

**Syntax**:

```don
directive_name {
  subdirective1
  subdirective2
}
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

**Whitespace**:

- Whitespace before `{` is optional: `foo{` is valid
- Whitespace after `}` is optional: `}tar` is valid

**Constraint**:

After a closing brace `}`, no additional tokens are allowed on the same directive line (except newlines).

**Valid**:

```don
container { image "nginx" }
```

**Invalid**:

```don
container { image "nginx" } extra  # Error: tokens after block close
```

---

## 4. Encoding Pipeline

### 4.1 PartSet Encoding

The `PartSetEncode` class scans raw input and produces a `PartSet`.

**Process**:

1. Convert input string to UTF-8 byte array
2. Scan bytes sequentially
3. Classify each byte by syntax kind
4. Group contiguous bytes of the same kind into parts
5. Return ordered collection of parts

**Example**:

Input: `"foo 123"`

Output PartSet:

- Part 1: `alphabet` → `[102, 111, 111]` (bytes for "foo")
- Part 2: `whitespace` → `[32]` (space)
- Part 3: `integer` → `[49, 50, 51]` (bytes for "123")

### 4.2 Lexema Encoding

The `LexemaEncode` class converts a `PartSet` into a `Lexema` (token stream).

**Process**:

1. Receive PartSet as input
2. Apply tokenization rules to group parts
3. Recognize patterns (e.g., negative numbers, decimals, strings)
4. Produce tokens with semantic meaning
5. Return Lexema containing ordered tokens

**Options**:

- `debug`: Include invisible tokens (whitespace, newlines, indents)
- `allowDebugDocument`: Store original document for debugging

**Example**:

Input PartSet: `foo 123`

Output Lexema:

- Token 1: `keyword("foo")`
- Token 2: `whitespace(" ")` (if debug enabled)
- Token 3: `numeric(123)`

### 4.3 Syntax Encoding

The `SyntaxEncode` class builds an Abstract Syntax Tree from a Lexema.

**Process**:

1. Receive Lexema as input
2. Parse tokens into hierarchical structure
3. Recognize directives, arguments, and blocks
4. Build AST nodes representing document structure
5. Return Syntax AST

**Example**:

Input:

```don
directive foo {
  directive2 taz lip {
    directive4
  }
  directive3 bob
}
bliz tar
```

Output: AST with nested directive nodes representing the hierarchical structure.

---

## 5. Whitespace and Formatting

### 5.1 Whitespace Handling

- **Spaces and tabs**: Classified as `whitespace` parts
- **Semantic role**: Separate tokens but are not significant in most contexts
- **Debug mode**: Whitespace tokens are included in lexema when `debug: true`

### 5.2 Newlines

- **Classification**: `newline` syntax kind
- **Semantic role**: Terminate directives and separate statements
- **Multiple newlines**: Consecutive newlines are preserved as separate tokens

**Example**:

```don
foo
tar
```

Produces: `keyword("foo")`, `newline`, `keyword("tar")`, `newline`

### 5.3 Indentation

- **Not semantically significant**: Unlike Python, indentation does not affect parsing
- **Stylistic**: Used for readability in nested blocks
- **Debug mode**: Indentation can be tracked as `indent` tokens

---

## 6. Examples

### 6.1 Simple Configuration

```don
name "my-application"
version "1.0.0"
port 8080
enabled true
```

### 6.2 Nested Blocks

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

### 6.3 Heredoc Content

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

### 6.4 Complex Directive

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

### 6.5 Mixed Types

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
