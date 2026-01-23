---
name: bun-test
description: Execute and verify tests with bun test, run integration tests with npm pack, and generate new snapshot tests for PartSetEncode, LexemaEncode, and SyntaxEncode. Use when the user asks to run tests, check if tests pass, verify the project works, run integration tests, or create new tests for the DON parser components.
---

# Bun Test

Execute tests, run integration tests, and generate new snapshot tests for the DON parser.

## Running Tests

Execute all tests:

```bash
scripts/run_tests.sh
```

Run specific test file:

```bash
scripts/run_tests.sh src/v1/syntax.spec.ts
```

Run with filter:

```bash
scripts/run_tests.sh --test-name-pattern "pattern"
```

## Integration Tests

Run integration tests to verify the package works correctly when installed:

```bash
scripts/integration_test.sh
```

This will:

1. Package the project with `npm pack`
2. Create a temporary directory in `/tmp/<name>`
3. Initialize a new project with `npm init -y`
4. Install the generated package
5. Run a validation script

### Custom Test Script

You can provide a custom test script:

```bash
scripts/integration_test.sh path/to/custom-test.js
```

The default test script validates basic module loading and exports.

## Generating New Tests

When creating new tests, follow the patterns in [test-patterns.md](references/test-patterns.md).

### Test Types

1. **PartSetEncode** - Low-level tokenization
2. **LexemaEncode** - Lexical analysis with tokens
3. **SyntaxEncode** - Full syntax tree (requires both lexema and syntax snapshots)

### Quick Reference

```typescript
// PartSetEncode
const partSetEncode = (snapshotName: string, value: string) => () => {
  const partSet = new PartSetEncode().encode(value);
  expect(partSet).toTokenSnapshot(snapshotName);
};
test("description", partSetEncode("snapshot-name", "input"));

// LexemaEncode
test("description", () => {
  const lexema = new LexemaEncode({ debug: true }).encode("input");
  expect(lexema).toTokenSnapshot("snapshot-name");
});

// SyntaxEncode
const snapSyntax = (snapshot: string, payload: string) => () => {
  expect(
    new LexemaEncode({ allowDebugDocument: true }).encode(payload),
  ).toTokenSnapshot(`${snapshot}-lexema`);
  expect(new SyntaxEncode().encode(payload)).toTokenSnapshot(
    `${snapshot}-syntax`,
  );
};
test("description", snapSyntax("snapshot-name", "input"));
```

Use kebab-case for snapshot names.
