import { describe, it, expect } from "bun:test";
import { DON } from "../../don.js";
import { variablesPlugin } from "./variables-plugin.js";
import {
  createClassResolverPlugin,
  parseAsClasses,
  resolveClasses,
  type ClassResolverContext,
} from "./class-resolver-plugin.js";

describe("createClassResolverPlugin / parseAsClasses — basic", () => {
  it("resolves a single directive with one arg into a class instance", () => {
    class Greeting {
      constructor(public readonly text: string) {}
    }

    const greeting = parseAsClasses<Greeting>('greeting "hi"', {
      greeting: Greeting,
    });

    expect(greeting).toBeInstanceOf(Greeting);
    expect(greeting.text).toBe("hi");
  });

  it("passes every positional arg through to the constructor, in order", () => {
    class Point {
      constructor(
        public readonly x: number,
        public readonly y: number,
      ) {}
    }

    const point = parseAsClasses<Point>("point 3 4", { point: Point });

    expect(point).toBeInstanceOf(Point);
    expect(point.x).toBe(3);
    expect(point.y).toBe(4);
  });

  it("leaves a directive not registered in the class map as an unwrapped scalar", () => {
    class Config {
      name?: unknown;
    }

    const config = parseAsClasses<Config & { name: string }>(
      'config {\n  name "prod"\n}\n',
      { config: Config },
    );

    expect(config).toBeInstanceOf(Config);
    expect(config.name).toBe("prod");
  });
});

describe("createClassResolverPlugin / parseAsClasses — nested classes", () => {
  class App {
    server?: Server;
    constructor(public readonly name: string) {}
  }
  class Server {
    host?: string;
    port?: number;
  }

  const text = ""
    + 'app "foo" {\n'
    + "  server {\n"
    + '    host "0.0.0.0"\n'
    + "    port 8080\n"
    + "  }\n"
    + "}\n";

  it("resolves a nested `server` block into a `Server` instance on `App`", () => {
    const app = parseAsClasses<App>(text, { app: App, server: Server });

    expect(app).toBeInstanceOf(App);
    expect(app.name).toBe("foo");
    expect(app.server).toBeInstanceOf(Server);
    expect(app.server!.host).toBe("0.0.0.0");
    expect(app.server!.port).toBe(8080);
  });

  it("still resolves `App` even when `Server` has no registered class (falls back to a plain object)", () => {
    const app = parseAsClasses<App>(text, { app: App });

    expect(app).toBeInstanceOf(App);
    expect(app.server).not.toBeInstanceOf(Server);
    expect(app.server).toEqual({ host: "0.0.0.0", port: 8080 });
  });
});

describe("createClassResolverPlugin / parseAsClasses — repeated directives and mixed shapes", () => {
  class ServerWithRoute {
    route?: unknown;
  }

  it("collapses a single occurrence of a child directive to its own resolved value", () => {
    const oneRoute = parseAsClasses<ServerWithRoute>(
      "server {\n  route /health\n}\n",
      { server: ServerWithRoute },
    );

    // A single `route` with one arg unwraps to that scalar, then gets
    // assigned as-is (not wrapped in an array) since there's only one.
    expect(oneRoute.route).toBe("/health");
  });

  it("collects repeated directives of the same name into an array, in document order", () => {
    const manyRoutes = parseAsClasses<ServerWithRoute>(
      ""
        + "server {\n"
        + "  route GET /health\n"
        + "  route GET /status\n"
        + "  route POST /webhook\n"
        + "}\n",
      { server: ServerWithRoute },
    );

    // Each `route` has two args, so it unwraps to an args array rather
    // than a scalar; three of them become an array of those arrays.
    expect(manyRoutes.route).toEqual([
      ["GET", "/health"],
      ["GET", "/status"],
      ["POST", "/webhook"],
    ]);
  });

  it("resolves an unregistered block with several distinct children into a plain object", () => {
    const text = ""
      + "feature-flags {\n"
      + "  sso true\n"
      + "  magic-link false\n"
      + "}\n";

    class Module {
      "feature-flags"?: unknown;
    }

    const module_ = parseAsClasses<Module>(
      `module {\n${text}}\n`,
      { module: Module },
    );

    expect(module_["feature-flags"]).toEqual({
      sso: true,
      "magic-link": false,
    });
  });
});

describe("createClassResolverPlugin / parseAsClasses — combined with other plugins", () => {
  it("runs after an earlier plugin, so a resolved `$var` reaches the class instance", () => {
    class Container {
      constructor(public readonly name: string) {}
    }

    const container = parseAsClasses<Container>(
      'set project "checkout"\ncontainer $project\n',
      { container: Container },
      [variablesPlugin],
    );

    expect(container).toBeInstanceOf(Container);
    expect(container.name).toBe("checkout");
  });
});

describe("createClassResolverPlugin / parseAsClasses — complex, multi-module document", () => {
  class App {
    constructor(public readonly name: string) {}
    module?: Module | Module[];
  }
  class Module {
    "feature-flags"?: Record<string, boolean>;
    routes?: unknown;
    constructor(public readonly id: string) {}
  }

  const text = ""
    + 'app "storefront" {\n'
    + "  module auth {\n"
    + "    feature-flags {\n"
    + "      sso true\n"
    + "    }\n"
    + "    routes {\n"
    + "      route POST /auth/login\n"
    + "    }\n"
    + "  }\n"
    + "\n"
    + "  module catalog {\n"
    + "    feature-flags {\n"
    + "      search-v2 true\n"
    + "    }\n"
    + "    routes {\n"
    + "      route GET /catalog/products\n"
    + "      route GET /catalog/search\n"
    + "    }\n"
    + "  }\n"
    + "}\n";

  it("resolves an app with several module instances, each with their own nested classes and route arrays", () => {
    const app = parseAsClasses<App>(text, { app: App, module: Module });

    expect(app).toBeInstanceOf(App);
    expect(app.name).toBe("storefront");
    expect(Array.isArray(app.module)).toBe(true);

    const modules = app.module as Module[];
    expect(modules).toHaveLength(2);
    expect(modules[0]).toBeInstanceOf(Module);
    expect(modules[0]!.id).toBe("auth");
    expect(modules[0]!["feature-flags"]).toEqual({ sso: true });
    // `routes` itself has no registered class, so it resolves to a plain
    // object of its own children — here a single `route` (two args, so
    // it unwraps to an args array rather than a scalar).
    expect(modules[0]!.routes).toEqual({ route: ["POST", "/auth/login"] });

    expect(modules[1]!.id).toBe("catalog");
    expect(modules[1]!["feature-flags"]).toEqual({ "search-v2": true });
    expect(modules[1]!.routes).toEqual({
      route: [
        ["GET", "/catalog/products"],
        ["GET", "/catalog/search"],
      ],
    });
  });

  it("exposes the same result through the lower-level `createClassResolverPlugin` + `resolveClasses` pair", () => {
    const ctx: ClassResolverContext = { stack: [[]] };
    const plugin = {
      ...createClassResolverPlugin({ app: App, module: Module }),
      initContext: () => ctx,
    };

    const directiveTree = DON.parse(text, { plugins: [plugin] });
    // The plugin never changes what DON.parse() itself returns — that's
    // always a Directive tree.
    expect(directiveTree.name).toBe("app");

    const app = resolveClasses<App>(ctx);
    expect(app).toBeInstanceOf(App);
    expect((app.module as Module[])).toHaveLength(2);
  });
});

describe("createClassResolverPlugin / resolveClasses — edge cases", () => {
  it("throws when resolving a context from a document with no directives", () => {
    const ctx: ClassResolverContext = { stack: [[]] };
    const plugin = {
      ...createClassResolverPlugin({}),
      initContext: () => ctx,
    };

    DON.parse("# just a comment\n", { plugins: [plugin] });

    expect(() => resolveClasses(ctx)).toThrow();
  });
});
