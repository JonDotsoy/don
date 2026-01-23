# Test Patterns

## Snapshot Test Pattern

Tests use `.toTokenSnapshot()` for snapshot testing:

```typescript
test("description", () => {
  const result = new Encoder().encode(input);
  expect(result).toTokenSnapshot("snapshot-name");
});
```

## Test Structure

### PartSetEncode Tests

Tests low-level tokenization of individual characters and simple patterns.

```typescript
const partSetEncode = (snapshotName: string, value: string) => () => {
  const partSet = new PartSetEncode().encode(value);
  expect(partSet).toTokenSnapshot(snapshotName);
};

test("description", partSetEncode("snapshot-name", "input"));
```

### LexemaEncode Tests

Tests lexical analysis with token generation.

```typescript
test("description", () => {
  const lexema = new LexemaEncode({ debug: true }).encode("input");
  expect(lexema).toTokenSnapshot("snapshot-name");
});
```

Options:

- `debug: true` - Enable debug mode
- `allowDebugDocument: true` - Allow debug document mode

### SyntaxEncode Tests

Tests full syntax tree generation. Always includes both lexema and syntax snapshots:

```typescript
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

## Naming Conventions

Snapshot names use kebab-case and describe the test case:

- `simple-identifier`
- `nested-curly-braces-route`
- `heredoc-html-simple`
- `identifier-double-quoted-escaped-identifier`
