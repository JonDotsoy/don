# `donly/schemas/openapi`

Describe an HTTP API as a `.donly` file — `openapi`/`info`/`server`/`route`/
`schema` directives — and:

- lint it against [`rules.donly`](./rules.donly), a `donly/lint`
  [`LintRuleDocument`](../../../docs/lint/rules.md) that checks the file
  follows the grammar this module understands (an `openapi` version, an
  `info` with `title`/`version`, at least one `route` with a valid HTTP
  method/path and at least one `response`, etc.);
- translate it into a plain OpenAPI 3.0 document object with
  `loadOpenapi(filePath)`.

## Grammar

```don
openapi "3.0.3"

info {
  title "Pet Store API"
  description "..."      # optional
  version "1.0.0"
}

server {                  # zero or more
  url "https://api.example.com/v1"
}

route GET /pets {          # zero or more
  summary "List all pets"  # optional
  operationId listPets     # optional

  param limit {             # zero or more
    in query                # query | path | header | cookie
    description "..."       # optional
    required false           # optional, defaults to false when omitted
    schema {
      type integer
      format int32
    }
  }

  response 200 {            # one or more
    description "A list of pets"
    content application/json {
      schema {
        type array
        items ref Pet        # $ref: #/components/schemas/Pet
      }
    }
  }
}

route POST /pets {
  requestBody {
    required true
    content application/json {
      schema ref NewPet
    }
  }
  response 201 {
    content application/json {
      schema ref Pet
    }
  }
}

schema NewPet {              # zero or more component schemas
  type object
  required name
  property name string
  property tag string
}

schema Pet {
  allOf ref NewPet            # $ref entry
  allOf {                     # inline object entry
    type object
    required id
    property id integer {
      format int64
    }
  }
}
```

See [`examples/demo-file-openapi.donly`](./examples/demo-file-openapi.donly)
for a complete file exercising every construct above, and
[`examples/minimal-api.donly`](./examples/minimal-api.donly) for the
smallest file `loadOpenapi` accepts (just `openapi`/`info`/one `route`).

## Linting a `.donly` API file

```sh
bunx donly lint --rules src/schemas/openapi/rules.donly \
  src/schemas/openapi/examples/demo-file-openapi.donly
```

[`examples/demo-file-openapi.invalid.donly`](./examples/demo-file-openapi.invalid.donly)
deliberately breaks every rule in `rules.donly` (missing `openapi`/`info
version`/`server url`, an invalid HTTP method, a path with no leading `/`,
a route with no `response`, and a response status code out of range) —
running the same command against it reports one issue per broken rule.

## Translating a `.donly` file into OpenAPI JSON

```ts
import { loadOpenapi } from "donly/schemas/openapi";

const doc = await loadOpenapi(
  "src/schemas/openapi/examples/demo-file-openapi.donly",
);

console.log(JSON.stringify(doc, null, 2));
```

`doc` is a plain object shaped like (abridged — see the file above for the
full output):

```json
{
  "openapi": "3.0.3",
  "info": {
    "title": "Pet Store API",
    "version": "1.0.0",
    "description": "Demo API used to exercise donly/schemas/openapi."
  },
  "servers": [{ "url": "https://api.example.com/v1" }],
  "paths": {
    "/pets": {
      "get": { "summary": "List all pets", "operationId": "listPets" },
      "post": { "summary": "Create a pet", "operationId": "createPet" }
    },
    "/pets/{petId}": { "get": { "summary": "Get a pet by id" } }
  },
  "components": {
    "schemas": { "NewPet": {}, "Pet": {}, "Error": {} }
  }
}
```

`openapiFromDirective(directive)` is also exported for converting an
already-parsed `Directive` (e.g. from `DON.parse()`) without re-reading a
file.
