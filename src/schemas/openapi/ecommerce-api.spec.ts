import { describe, test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { loadOpenapi } from "./load-openapi.js";

const dir = new URL(".", import.meta.url).pathname;
const examplePath = (name: string) => join(dir, "examples", name);

describe("loadOpenapi (Beeceptor e-commerce sample)", () => {
  test("translating ecommerce-api.donly equals the official OpenAPI JSON", async () => {
    const expected = JSON.parse(
      readFileSync(examplePath("ecommerce-openapi.json"), "utf8"),
    );

    const doc = await loadOpenapi(examplePath("ecommerce-api.donly"));

    expect(doc).toEqual(expected);
  });
});
