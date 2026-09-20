# OpenAPI JSON Example

This folder contains a minimal OpenAPI 3.0 document (`openapi.json`) describing
a small "Pet Store" API, alongside an equivalent DON document
(`pet-store.don`) describing the same routes and schemas.

It exists to show how the same API surface can be expressed either as a
nested JSON structure or as a flat sequence of DON directives.

## Files

- [`openapi.json`](./openapi.json) — the API described as a standard
  [OpenAPI 3.0](https://spec.openapis.org/oas/v3.0.3) document.
- [`pet-store.don`](./pet-store.don) — the same routes and schemas described
  as DON directives (`route`, `schema`, `param`, `respond`, `field`, ...).

## Comparing the two

The OpenAPI document nests every detail of an operation (parameters, request
body, responses) inside JSON objects keyed by path and HTTP method:

```json
"/pets/{petId}": {
  "get": {
    "parameters": [
      { "name": "petId", "in": "path", "required": true, "schema": { "type": "integer" } }
    ]
  }
}
```

The DON equivalent expresses the same information as one directive per
concern, with arguments in place of nested keys:

```don
route GET /pets/{petId} {
  param petId path integer required
  respond 200 Pet
}
```

Both files describe the same three endpoints (`GET /pets`, `POST /pets`,
`GET /pets/{petId}`) and the same `Pet`, `NewPet`, and `Error` shapes.
