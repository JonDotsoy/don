import { describe, test, expect } from "bun:test";
import { join } from "node:path";
import { DON } from "../../don.js";
import { loadOpenapi, openapiFromDirective } from "./load-openapi.js";

const dir = new URL(".", import.meta.url).pathname;
const examplePath = (name: string) => join(dir, "examples", name);

describe("loadOpenapi", () => {
  test("translates the full demo file into an OpenAPI document", async () => {
    const doc = await loadOpenapi(examplePath("demo-file-openapi.donly"));

    expect(doc.openapi).toBe("3.0.3");
    expect(doc.info).toEqual({
      title: "Pet Store API",
      description: "Demo API used to exercise donly/schemas/openapi.",
      version: "1.0.0",
    });
    expect(doc.servers).toEqual([{ url: "https://api.example.com/v1" }]);

    expect(Object.keys(doc.paths)).toEqual(["/pets", "/pets/{petId}"]);

    const listPets = doc.paths["/pets"]?.["get"];
    expect(listPets?.summary).toBe("List all pets");
    expect(listPets?.operationId).toBe("listPets");
    expect(listPets?.parameters).toEqual([
      {
        name: "limit",
        in: "query",
        description: "Maximum number of pets to return",
        required: false,
        schema: { type: "integer", format: "int32" },
      },
    ]);
    expect(listPets?.responses["200"]).toEqual({
      description: "A list of pets",
      content: {
        "application/json": {
          schema: {
            type: "array",
            items: { $ref: "#/components/schemas/Pet" },
          },
        },
      },
    });

    const createPet = doc.paths["/pets"]?.["post"];
    expect(createPet?.requestBody).toEqual({
      required: true,
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/NewPet" },
        },
      },
    });

    const getPetById = doc.paths["/pets/{petId}"]?.["get"];
    expect(getPetById?.parameters).toEqual([
      {
        name: "petId",
        in: "path",
        required: true,
        schema: { type: "integer", format: "int64" },
      },
    ]);
    expect(Object.keys(getPetById?.responses ?? {})).toEqual(["200", "404"]);

    expect(doc.components?.schemas?.["NewPet"]).toEqual({
      type: "object",
      required: ["name"],
      properties: {
        name: { type: "string" },
        tag: { type: "string" },
      },
    });
    expect(doc.components?.schemas?.["Pet"]).toEqual({
      allOf: [
        { $ref: "#/components/schemas/NewPet" },
        {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "integer", format: "int64" },
          },
        },
      ],
    });
    expect(doc.components?.schemas?.["Error"]).toEqual({
      type: "object",
      required: ["code", "message"],
      properties: {
        code: { type: "integer", format: "int32" },
        message: { type: "string" },
      },
    });
  });

  test("translates a minimal file with only a root-level route and no schemas", async () => {
    const doc = await loadOpenapi(examplePath("minimal-api.donly"));

    expect(doc.openapi).toBe("3.0.3");
    expect(doc.info).toEqual({ title: "Minimal API", version: "1.0.0" });
    expect(doc.servers).toBeUndefined();
    expect(doc.components).toBeUndefined();
    expect(doc.paths).toEqual({
      "/health": {
        get: {
          summary: "Health check",
          operationId: "getHealth",
          responses: {
            "200": { description: "Service is healthy" },
          },
        },
      },
    });
  });

  test("defaults openapi/info when the document has a single top-level route", async () => {
    // DON.parse() unwraps a single top-level directive instead of wrapping
    // it in a synthetic root — exercises that branch of openapiFromDirective.
    const root = DON.parse(`
route GET /ping {
  response 200 {
    description "pong"
  }
}
`);

    const doc = openapiFromDirective(root);

    expect(doc.openapi).toBe("3.0.3");
    expect(doc.info).toEqual({ title: "", version: "" });
    expect(doc.paths).toEqual({
      "/ping": {
        get: { responses: { "200": { description: "pong" } } },
      },
    });
  });

  test("merges multiple routes for the same path into separate methods", async () => {
    const root = DON.parse(`
openapi "3.0.3"
info {
  title "Multi-method API"
  version "1.0.0"
}
route GET /items {
  response 200 {
    description "list"
  }
}
route POST /items {
  response 201 {
    description "created"
  }
}
`);

    const doc = openapiFromDirective(root);

    expect(Object.keys(doc.paths["/items"] ?? {})).toEqual(["get", "post"]);
  });
});
