import { describe, it, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DON, Directive } from "../don.js";
import { DirectiveJSONEncoder } from "../directive-json.js";

const dir = new URL(".", import.meta.url).pathname;

// A monolithic app split into several modules (identified with bracket
// identifiers), each toggled with `enabled`, depending on other modules
// via `needs`, and declaring its own feature flags and routes.
const config = readFileSync(join(dir, "monolith-app-example.donly"), "utf8");

const findChild = (directive: Directive, name: string) =>
  directive.children.find((child) => child.name === name);

const findChildren = (directive: Directive, name: string) =>
  directive.children.filter((child) => child.name === name);

describe("donly/demo monolith app example", () => {
  it("parses the app into a single root directive", () => {
    const root = DON.parse(config);

    expect(root).toBeInstanceOf(Directive);
    expect(root.name).toBe("app");
    expect(root.args).toEqual(["storefront"]);
  });

  it("parses the shared server and database blocks", () => {
    const root = DON.parse(config);

    const server = findChild(root, "server")!;
    expect(server.children.map((c) => [c.name, c.args])).toEqual([
      ["host", ["0.0.0.0"]],
      ["port", [3000]],
    ]);

    const database = findChild(root, "database")!;
    expect(database.args).toEqual(["primary"]);
    expect(findChild(database, "driver")?.args).toEqual(["postgres"]);
    expect(findChild(database, "pool")?.args).toEqual([20]);
  });

  it("identifies each module by its bracketed identifier", () => {
    const root = DON.parse(config);

    const modules = root.children.filter((child) =>
      /^module-\[.+\]$/.test(String(child.name)),
    );

    expect(modules.map((m) => m.name)).toEqual([
      "module-[auth]",
      "module-[catalog]",
      "module-[cart]",
      "module-[checkout]",
      "module-[notifications]",
    ]);
  });

  it("toggles modules on and off with `enabled`", () => {
    const root = DON.parse(config);

    const auth = findChild(root, "module-[auth]")!;
    const notifications = findChild(root, "module-[notifications]")!;

    expect(findChild(auth, "enabled")?.args).toEqual([true]);
    expect(findChild(notifications, "enabled")?.args).toEqual([false]);
  });

  it("chains modules together with `needs`", () => {
    const root = DON.parse(config);

    const catalog = findChild(root, "module-[catalog]")!;
    const cart = findChild(root, "module-[cart]")!;
    const checkout = findChild(root, "module-[checkout]")!;

    expect(findChild(catalog, "needs")?.args).toEqual(["auth"]);
    expect(findChild(cart, "needs")?.args).toEqual(["auth", "catalog"]);
    expect(findChild(checkout, "needs")?.args).toEqual(["auth", "cart"]);
  });

  it("declares per-module feature flags", () => {
    const root = DON.parse(config);

    const checkout = findChild(root, "module-[checkout]")!;
    const flags = findChild(checkout, "feature-flags")!;

    expect(flags.children.map((c) => [c.name, c.args])).toEqual([
      ["express-checkout", [true]],
      ["buy-now-pay-later", [false]],
    ]);
  });

  it("declares per-module routes", () => {
    const root = DON.parse(config);

    const cart = findChild(root, "module-[cart]")!;
    const routes = findChild(cart, "routes")!;

    expect(findChildren(routes, "route").map((r) => r.args)).toEqual([
      ["GET", "/cart"],
      ["POST", "/cart/items"],
      ["DELETE", "/cart/items/[id]"],
    ]);
  });

  it("lets a module use a different backing resource, like a queue instead of a database", () => {
    const root = DON.parse(config);

    const notifications = findChild(root, "module-[notifications]")!;

    expect(findChild(notifications, "queue")?.args).toEqual(["redis"]);
    expect(findChild(notifications, "database")).toBeUndefined();
  });

  it("round-trips the whole config through the DirectiveJSONEncoder", () => {
    const root = DON.parse(config);
    const value = DirectiveJSONEncoder.encode(root, { reducer: null });

    expect(Array.isArray(value)).toBe(true);
    const [app] = value as any[];
    expect(app.name).toBe("app");
    expect(app.args).toEqual(["storefront"]);

    const moduleNames = app.children
      .filter((c: any) => /^module-\[.+\]$/.test(c.name))
      .map((c: any) => c.name);
    expect(moduleNames).toEqual([
      "module-[auth]",
      "module-[catalog]",
      "module-[cart]",
      "module-[checkout]",
      "module-[notifications]",
    ]);
  });
});
