# OpenAPI JSON Example

This folder contains a minimal OpenAPI 3.0 document (`pet-store.json`)
describing a small "Pet Store" API, alongside a DON document
(`pet-store.don`) that carries **every property** of the JSON document as a
DON directive — same `info`, `servers`, paths, parameters, request bodies,
responses, and `components.schemas`, nothing dropped.

It exists to show how the same API surface can be expressed either as a
nested JSON structure or as a flat sequence of DON directives.

## Files

- [`pet-store.json`](./pet-store.json) — the API described as a standard
  [OpenAPI 3.0](https://spec.openapis.org/oas/v3.0.3) document.
- [`pet-store.don`](./pet-store.don) — the same document described as DON
  directives (`openapi`, `info`, `server`, `route`, `param`, `requestBody`,
  `response`, `content`, `schema`, `property`, `allOf`, ...).

## Comparing the two

The OpenAPI document nests every detail of an operation (parameters, request
body, responses) inside JSON objects keyed by path and HTTP method:

```json
"/pets/{petId}": {
  "get": {
    "summary": "Get a pet by id",
    "operationId": "getPetById",
    "parameters": [
      {
        "name": "petId",
        "in": "path",
        "required": true,
        "schema": { "type": "integer", "format": "int64" }
      }
    ],
    "responses": {
      "200": {
        "description": "The requested pet",
        "content": {
          "application/json": { "schema": { "$ref": "#/components/schemas/Pet" } }
        }
      }
    }
  }
}
```

The DON equivalent expresses the same information as one directive per
concern, with arguments in place of nested keys, but keeps every field —
`operationId`, parameter `in`/`required`, `schema.format`, response
`description`, and the response `content` type:

```don
route GET /pets/{petId} {
  summary "Get a pet by id"
  operationId getPetById
  param petId {
    in path
    required true
    schema {
      type integer
      format int64
    }
  }
  response 200 {
    description "The requested pet"
    content application/json {
      schema ref Pet
    }
  }
}
```

## Property mapping

| JSON property                                        | DON equivalent                                                        |
| ---------------------------------------------------- | --------------------------------------------------------------------- |
| `openapi`                                            | `openapi "3.0.3"`                                                     |
| `info.title` / `.description` / `.version`           | `info { title ... description ... version ... }`                      |
| `servers[].url`                                      | `server { url ... }`                                                  |
| `paths.<path>.<method>.summary`                      | `route METHOD PATH { summary ... }`                                   |
| `.operationId`                                       | `operationId ...`                                                     |
| `.parameters[].name/in/description/required/schema`  | `param <name> { in ... description ... required ... schema { ... } }` |
| `.requestBody.required/content`                      | `requestBody { required ... content <type> { schema ... } }`          |
| `.responses.<code>.description/content`              | `response <code> { description ... content <type> { schema ... } }`   |
| `components.schemas.<Name>.type/required/properties` | `schema <Name> { type ... required ... property <name> { ... } }`     |
| `allOf`                                              | `allOf ref <Name>` / `allOf { ... }`                                  |
| `$ref`                                               | `ref <Name>`                                                          |

Both files describe the same three endpoints (`GET /pets`, `POST /pets`,
`GET /pets/{petId}`) and the same `Pet`, `NewPet`, and `Error` shapes, with a
1:1 property mapping between them.
