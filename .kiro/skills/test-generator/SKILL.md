---
name: test-generator
description: Generate unit tests for TypeScript/JavaScript code using Bun test framework. Use when the user requests to create tests, add test coverage, write unit tests, or test a specific class/function. Follows project-specific patterns with bun:test imports and snapshot testing.
---

# Test Generator

Generate unit tests following this project's conventions using Bun's test framework.

## Test File Structure

Create test files with `.spec.ts` extension next to the source file being tested.

Basic template:

```typescript
import { describe, test, expect } from "bun:test"

describe("<ClassName or ModuleName>", () => {
  test("should <behavior description>", () => {
    // Arrange
    const input = ...

    // Act
    const result = ...

    // Assert
    expect(result).toEqual(expected)
  })
})
```

## Test Patterns

### Multiline String Syntax

When working with multiline strings in tests, use this concatenation syntax:

```typescript
const multilineString = "" + "foo\n" + "taz\n" + "biz\n";
```

Always start with an empty string `''` so all lines begin with `+` for consistent formatting.

Example in test:

```typescript
test("should handle multiline input", () => {
  const input = "" + "tar\n" + "bin\n";

  const result = print(input);
  expect(result).toEqual(expected);
});
```

### Basic Assertions

```typescript
expect(value).toEqual(expected);
expect(value).toBeTrue();
expect(value).not.toBeTrue();
expect(array).toEqual([1, 2, 3]);
```

### Snapshot Testing

For complex output validation, use custom snapshot matchers:

```typescript
import "./__utils__/to-token-snapshot.js";

test("should encode complex structure", () => {
  const result = encoder.encode(input);
  expect(result).toTokenSnapshot("snapshot-name");
});
```

### Helper Functions

Create reusable test helpers within describe blocks:

```typescript
describe("Encoder", () => {
  const encodeTest = (snapshotName: string, input: string) => () => {
    const result = new Encoder().encode(input);
    expect(result).toTokenSnapshot(snapshotName);
  };

  test("should encode simple case", encodeTest("simple-case", "input"));
  test(
    "should encode complex case",
    encodeTest("complex-case", "complex input"),
  );
});
```

## Formatting

After writing tests, always format with Prettier:

```bash
prettier -w <filename>.spec.ts
```

## Test Organization

- Group related tests in `describe` blocks
- Use descriptive test names starting with "should"
- Keep tests focused on single behaviors
- Use Arrange-Act-Assert pattern for clarity
