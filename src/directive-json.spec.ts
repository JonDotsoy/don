import { describe, it, expect } from "bun:test";
import { DON, Directive, HeredocValue } from "./don";
import { DirectiveJSONEncoder, DirectiveJSONDecoder } from "./directive-json";
import { ROOT_DIRECTIVE_NAME } from "./directive-json";
import type { DirectiveReducer } from "./directive-json";

const complexServerConfig = ""
  + "server {\n"
  + "  port 8080\n"
  + '  host "0.0.0.0"\n'
  + "  tls true\n"
  + "\n"
  + "  middleware cors {\n"
  + '    origin "*"\n'
  + "  }\n"
  + "  middleware logger\n"
  + "\n"
  + "  route /users GET {\n"
  + '    handler "listUsers"\n'
  + "    auth true\n"
  + "  }\n"
  + "  route /users POST {\n"
  + '    handler "createUser"\n'
  + "    auth true\n"
  + "  }\n"
  + "  route /health GET {\n"
  + '    handler "healthCheck"\n'
  + "  }\n"
  + "\n"
  + "  upstream api {\n"
  + '    server "10.0.0.1:9000"\n'
  + '    server "10.0.0.2:9000"\n'
  + "  }\n"
  + "}\n";

describe("DirectiveJSONEncoder.encode", () => {
  it("encodes a flat directive using the tuple reducer by default", () => {
    const directive = DON.parse('name "my-package"');

    const value = DirectiveJSONEncoder.encode(directive);

    expect(value).toEqual({ name: "my-package" });
  });

  it("encodes nested directives using the tuple reducer by default", () => {
    const directive = DON.parse(""
      + "server {\n"
      + '  host "localhost"\n'
      + "  port 8080\n"
      + "}\n"
    );

    const value = DirectiveJSONEncoder.encode(directive);

    expect(value).toEqual({
      server: { host: "localhost", port: 8080 },
    });
  });

  it("falls back to the lossless {name, args, children} array shape when reducer is null", () => {
    const directive = DON.parse(""
      + "server {\n"
      + '  host "localhost"\n'
      + "  port 8080\n"
      + "}\n"
    );

    const value = DirectiveJSONEncoder.encode(directive, { reducer: null });

    expect(value).toEqual([
      {
        name: "server",
        args: [],
        children: [
          { name: "host", args: ["localhost"], children: [] },
          { name: "port", args: [8080], children: [] },
        ],
      },
    ]);
  });

  it("encodes with the tuple reducer into a keyed object", () => {
    const directive = DON.parse(""
      + "server {\n"
      + '  host "localhost"\n'
      + "  port 8080\n"
      + "}\n"
    );

    const value = DirectiveJSONEncoder.encode(directive, {
      reducer: DirectiveJSONEncoder.tupleReducer,
    });

    expect(value).toEqual({
      server: { host: "localhost", port: 8080 },
    });
  });

  it("encodes a directive whose args have no children as an args array", () => {
    const directive = DON.parse(""
      + "server {\n"
      + "  port 3000\n"
      + "  get /foo 200 OK\n"
      + "}\n"
    );

    const value = DirectiveJSONEncoder.encode(directive, {
      reducer: DirectiveJSONEncoder.tupleReducer,
    });

    expect(value).toEqual({
      server: { port: 3000, get: ["/foo", 200, "OK"] },
    });
  });

  it("groups repeated sibling directives into an array of [...args, children]", () => {
    const directive = DON.parse(""
      + "server {\n"
      + "  port 3000\n"
      + "  get /foo 200 OK {\n"
      + "    accept json\n"
      + "  }\n"
      + "  get /biz 200 OK {\n"
      + "    accept xml\n"
      + "  }\n"
      + "}\n"
    );

    const value = DirectiveJSONEncoder.encode(directive, {
      reducer: DirectiveJSONEncoder.tupleReducer,
    });

    expect(value).toEqual({
      server: {
        port: 3000,
        get: [
          ["/foo", 200, "OK", { accept: "json" }],
          ["/biz", 200, "OK", { accept: "xml" }],
        ],
      },
    });
  });

  it("encodes a complex server config with the tuple reducer", () => {
    const directive = DON.parse(complexServerConfig);

    const value = DirectiveJSONEncoder.encode(directive, {
      reducer: DirectiveJSONEncoder.tupleReducer,
    });

    expect(value).toEqual({
      server: {
        port: 8080,
        host: "0.0.0.0",
        tls: true,
        // repeated siblings, one with children and one without, group
        // into a mixed array of [name, children] and plain values
        middleware: [["cors", { origin: "*" }], "logger"],
        // repeated siblings with args + children group into an array
        // of [...args, children] entries
        route: [
          ["/users", "GET", { handler: "listUsers", auth: true }],
          ["/users", "POST", { handler: "createUser", auth: true }],
          ["/health", "GET", { handler: "healthCheck" }],
        ],
        // a single (non-repeated) directive with both args and
        // children still renders as [...args, children], just without
        // the extra grouping array
        upstream: [
          "api",
          {
            // repeated siblings with only args (no children) group into
            // a plain array of their scalar values
            server: ["10.0.0.1:9000", "10.0.0.2:9000"],
          },
        ],
      },
    });
  });

  it("encodes a directive's args as nested object keys with the nested reducer", () => {
    const directive = DON.parse(""
      + "server {\n"
      + "  port 3000\n"
      + "  get /foo 200 OK\n"
      + "}\n"
    );

    const value = DirectiveJSONEncoder.encode(directive, {
      reducer: DirectiveJSONEncoder.nestedReducer,
    });

    expect(value).toEqual({
      server: { port: 3000, get: { "/foo": { "200": "OK" } } },
    });
  });

  it("encodes a complex server config with the nested reducer", () => {
    const directive = DON.parse(complexServerConfig);

    const value = DirectiveJSONEncoder.encode(directive, {
      reducer: DirectiveJSONEncoder.nestedReducer,
    });

    expect(value).toEqual({
      server: {
        port: 8080,
        host: "0.0.0.0",
        tls: true,
        // each arg becomes a nested object key wrapping the next level,
        // instead of a flat [...args, children] array
        middleware: [{ cors: { origin: "*" } }, "logger"],
        route: [
          { "/users": { GET: { handler: "listUsers", auth: true } } },
          { "/users": { POST: { handler: "createUser", auth: true } } },
          { "/health": { GET: { handler: "healthCheck" } } },
        ],
        // a single (non-repeated) directive still nests without an
        // extra grouping array
        upstream: {
          api: {
            server: ["10.0.0.1:9000", "10.0.0.2:9000"],
          },
        },
      },
    });
  });

  it("accepts a custom reducer function", () => {
    const directives = [new Directive("name", ["my-package"])];

    const upperCaseNameReducer: DirectiveReducer = (acc, directive) => {
      acc[(directive.name as string).toUpperCase()] = directive.args;
      return acc;
    };

    const value = DirectiveJSONEncoder.encode(directives, {
      reducer: upperCaseNameReducer,
    });

    expect(value).toEqual({ NAME: ["my-package"] });
  });

  it("passes the parent directive as the reducer's 3rd argument, using the ROOT_DIRECTIVE_NAME sentinel at the top level", () => {
    const directive = DON.parse(""
      + "server {\n"
      + '  host "localhost"\n'
      + "}\n"
    );

    const parentsByName: Record<string, string | symbol> = {};

    const trackParentsReducer: DirectiveReducer = (acc, directive, parent) => {
      parentsByName[directive.name as string] = parent.name;

      acc[directive.name as string] = directive.children.length
        ? directive.children.reduce(
            (childAcc, child) => trackParentsReducer(childAcc, child, directive),
            {},
          )
        : directive.args;

      return acc;
    };

    DirectiveJSONEncoder.encode(directive, { reducer: trackParentsReducer });

    expect(parentsByName).toEqual({
      server: ROOT_DIRECTIVE_NAME,
      host: "server",
    });
  });

  it("groups repeated root-level directives sharing a name", () => {
    const directive = DON.parse(""
      + "server {\n"
      + '  name "web"\n'
      + "  port 8080\n"
      + "}\n"
      + "server {\n"
      + '  name "admin"\n'
      + "  port 9090\n"
      + "}\n"
    );

    const value = DirectiveJSONEncoder.encode(directive, {
      reducer: DirectiveJSONEncoder.tupleReducer,
    });

    expect(value).toEqual({
      server: [
        { name: "web", port: 8080 },
        { name: "admin", port: 9090 },
      ],
    });
  });

  const multiServerConfig = ""
    + "server {\n"
    + '  name "web"\n'
    + "  port 8080\n"
    + '  host "0.0.0.0"\n'
    + "  tls true\n"
    + "\n"
    + "  route /health GET {\n"
    + '    handler "healthCheck"\n'
    + "  }\n"
    + "}\n"
    + "server {\n"
    + '  name "admin"\n'
    + "  port 9090\n"
    + '  host "127.0.0.1"\n'
    + "  tls false\n"
    + "\n"
    + "  route /metrics GET {\n"
    + '    handler "metrics"\n'
    + "  }\n"
    + "}\n";

  it("encodes multiple root-level servers with the tuple reducer", () => {
    const directive = DON.parse(multiServerConfig);

    const value = DirectiveJSONEncoder.encode(directive, {
      reducer: DirectiveJSONEncoder.tupleReducer,
    });

    expect(value).toEqual({
      server: [
        {
          name: "web",
          port: 8080,
          host: "0.0.0.0",
          tls: true,
          route: ["/health", "GET", { handler: "healthCheck" }],
        },
        {
          name: "admin",
          port: 9090,
          host: "127.0.0.1",
          tls: false,
          route: ["/metrics", "GET", { handler: "metrics" }],
        },
      ],
    });
  });

  it("encodes multiple root-level servers with the nested reducer", () => {
    const directive = DON.parse(multiServerConfig);

    const value = DirectiveJSONEncoder.encode(directive, {
      reducer: DirectiveJSONEncoder.nestedReducer,
    });

    expect(value).toEqual({
      server: [
        {
          name: "web",
          port: 8080,
          host: "0.0.0.0",
          tls: true,
          route: { "/health": { GET: { handler: "healthCheck" } } },
        },
        {
          name: "admin",
          port: 9090,
          host: "127.0.0.1",
          tls: false,
          route: { "/metrics": { GET: { handler: "metrics" } } },
        },
      ],
    });
  });
});

describe("DirectiveJSONDecoder#decode", () => {
  it("decodes a flat directive from a lossless array shape", () => {
    const value = [{ name: "name", args: ["my-package"], children: [] }];

    const directives = new DirectiveJSONDecoder().decode(value);

    expect(directives).toHaveLength(1);
    expect(directives[0]).toBeInstanceOf(Directive);
    expect(directives[0]!.name).toBe("name");
    expect(directives[0]!.args).toEqual(["my-package"]);
  });

  it("decodes nested directives from a lossless array shape", () => {
    const value = [
      {
        name: "server",
        args: [],
        children: [
          { name: "host", args: ["localhost"], children: [] },
          { name: "port", args: [8080], children: [] },
        ],
      },
    ];

    const directives = new DirectiveJSONDecoder().decode(value);

    expect(directives[0]!.children).toHaveLength(2);
    expect(directives[0]!.children[0]).toBeInstanceOf(Directive);
    expect(directives[0]!.children[0]!.name).toBe("host");
    expect(directives[0]!.children[1]!.args).toEqual([8080]);
  });

  it("round-trips through DON.parse -> encode -> decode", () => {
    const text = ""
      + 'name "@tar"\n'
      + "dependencies {\n"
      + '  zod ">=1"\n'
      + "}\n";

    const original = DON.parse(text);
    const value = DirectiveJSONEncoder.encode(original);
    const decoded = new DirectiveJSONDecoder().decode(value);

    expect(decoded).toEqual(original.children);
  });

  it("round-trips a heredoc argument through DON.parse -> encode -> decode", () => {
    const text = ""
      + "server {\n"
      + "  response <<<HTML\n"
      + "    <html></html>\n"
      + "  handler\n"
      + "}\n";

    const original = DON.parse(text);
    const value = DirectiveJSONEncoder.encode(original, { reducer: null });
    const decoded = new DirectiveJSONDecoder().decode(value);

    expect(decoded).toHaveLength(1);
    expect(decoded[0]).toEqual(original);
    expect(decoded[0]!.children[0]!.args[0]).toBeInstanceOf(HeredocValue);
  });

  it("round-trips a lone heredoc argument through the reduced (tuple) JSON shape", () => {
    const text = ""
      + "server {\n"
      + "  response <<<HTML\n"
      + "    <html></html>\n"
      + "}\n";

    const original = DON.parse(text);
    const value = DirectiveJSONEncoder.encode(original);
    const decoded = new DirectiveJSONDecoder().decode(value);

    expect(decoded[0]!.children[0]!.args[0]).toEqual(
      new HeredocValue("HTML", "<html></html>\n"),
    );
  });

  it("decodes a reduced (object) JSON shape back into directives", () => {
    const value = { server: { host: "localhost", port: 8080 } };

    const directives = new DirectiveJSONDecoder().decode(value);

    expect(directives).toHaveLength(1);
    expect(directives[0]).toBeInstanceOf(Directive);
    expect(directives[0]!.name).toBe("server");
    expect(directives[0]!.args).toEqual([]);
    expect(directives[0]!.children).toHaveLength(2);
    expect(directives[0]!.children[0]!.name).toBe("host");
    expect(directives[0]!.children[0]!.args).toEqual(["localhost"]);
    expect(directives[0]!.children[1]!.name).toBe("port");
    expect(directives[0]!.children[1]!.args).toEqual([8080]);
  });

  it("round-trips through the tuple reducer and decode", () => {
    const original = DON.parse(""
      + "server {\n"
      + '  host "localhost"\n'
      + "  port 8080\n"
      + "}\n"
    );

    const value = DirectiveJSONEncoder.encode(original, {
      reducer: DirectiveJSONEncoder.tupleReducer,
    });
    const decoded = new DirectiveJSONDecoder().decode(value);

    expect(decoded).toHaveLength(1);
    expect(decoded[0]).toEqual(original);
  });

  it("round-trips using both classes as instances rather than statically", () => {
    const original = DON.parse(""
      + "server {\n"
      + '  host "localhost"\n'
      + "  port 8080\n"
      + "}\n"
    );

    const encoded = new DirectiveJSONEncoder().encode(original, {
      reducer: DirectiveJSONEncoder.tupleReducer,
    });
    const decoded = new DirectiveJSONDecoder().decode(encoded);

    expect(decoded).toHaveLength(1);
    expect(decoded[0]).toEqual(original);
  });

  it("throws on an array value mixing objects with a reduced directive", () => {
    const value = { server: [{ host: "localhost" }] };

    expect(() => new DirectiveJSONDecoder().decode(value)).toThrow();
  });

  it("throws on a top-level JSON value that is neither an array nor an object", () => {
    expect(() => new DirectiveJSONDecoder().decode("nope")).toThrow();
  });

  it("throws when a directive is missing required fields", () => {
    expect(() => new DirectiveJSONDecoder().decode([{ args: [], children: [] }]))
      .toThrow();
  });
});
