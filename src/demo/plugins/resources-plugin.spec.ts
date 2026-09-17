import { describe, it, expect } from "bun:test";
import { DON } from "../../don.js";
import { createResourcesPlugin } from "./resources-plugin.js";

describe("createResourcesPlugin", () => {
  it("expands a `resource sqlite file://...` directive into size/table/columns children", () => {
    const result = DON.parse("resource sqlite file://./db.sqlite", {
      plugins: [createResourcesPlugin({ cwd: "/srv/app" })],
    });

    expect(result.name).toBe("resource");
    expect(result.args).toEqual(["sqlite", "file:///srv/app/db.sqlite"]);

    const size = result.find("/resource/size");
    expect(size?.args).toEqual([34, "megabites"]);

    const userTable = result.find("/resource/table(user)");
    expect(userTable?.find("/table(user)/rows")?.args).toEqual([350]);
    const userColumns = userTable?.at("/table(user)/columns");
    expect(userColumns?.children.map((c) => [c.name, c.args])).toEqual([
      ["user_id", ["TEXT", "primarykey"]],
      ["name", ["TEXT"]],
      ["role", ["TEXT"]],
    ]);

    const productTable = result.find("/resource/table(product)");
    expect(productTable?.find("/table(product)/rows")?.args).toEqual([7000]);
    const productColumns = productTable?.children.find(
      (c) => c.name === "columns",
    );
    expect(productColumns?.children.map((c) => [c.name, c.args])).toEqual([
      ["product_id", ["TEXT", "primarykey"]],
      ["name", ["TEXT"]],
      ["price", ["INTEGER"]],
    ]);
  });

  it("resolves a relative file:// path against the given cwd", () => {
    const result = DON.parse("resource sqlite file://../shared/data.sqlite", {
      plugins: [createResourcesPlugin({ cwd: "/srv/app/current" })],
    });

    expect(result.args[1]).toBe("file:///srv/app/shared/data.sqlite");
  });

  it("leaves an unknown resource type untouched", () => {
    const result = DON.parse("resource postgres postgres://localhost/db", {
      plugins: [createResourcesPlugin()],
    });

    expect(result.args).toEqual(["postgres", "postgres://localhost/db"]);
    expect(result.children).toEqual([]);
  });

  it("leaves non-resource directives, and resources without a file:// URL, untouched", () => {
    const result = DON.parse(
      "host localhost\nresource sqlite not-a-file-url",
      { plugins: [createResourcesPlugin()] },
    );

    expect(result.children[0]!.args).toEqual(["localhost"]);
    expect(result.children[1]!.args).toEqual(["sqlite", "not-a-file-url"]);
    expect(result.children[1]!.children).toEqual([]);
  });
});
