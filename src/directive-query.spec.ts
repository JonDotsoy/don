import { describe, it, expect } from "bun:test";
import { DON, Directive } from "./don";

const SERVER_TEXT = ""
  + "server {\n"
  + '  router /users {\n'
  + '    respond 200 "Ok"\n'
  + "  }\n"
  + '  router /user/:user_id {\n'
  + '    respond 200 "Ok"\n'
  + "  }\n"
  + '  router /admin {\n'
  + '    respond 403 "Forbidden"\n'
  + "  }\n"
  + "}\n";

describe("Directive#findAll", () => {
  it("returns all directives matching the path", () => {
    const directive = DON.parse(SERVER_TEXT);

    const match = directive.findAll("/server/router");

    expect(match).toHaveLength(3);
    expect(match.map(([path]) => path)).toEqual([
      "/users",
      "/user/:user_id",
      "/admin",
    ]);
  });

  it("returns an empty ResultMatchDirectives for an unmatched path", () => {
    const directive = DON.parse(SERVER_TEXT);

    expect(directive.findAll("/server/unknown")).toEqual([]);
  });

  it("returns an empty ResultMatchDirectives for an empty or root-only path", () => {
    const directive = DON.parse(SERVER_TEXT);

    expect(directive.findAll("")).toEqual([]);
    expect(directive.findAll("/")).toEqual([]);
  });

  it("works on documents with multiple top-level directives (synthetic root)", () => {
    const directive = DON.parse("a { x 1 }\nb { x 2 }\n");

    expect(directive.findAll("/a")).toHaveLength(1);
    expect(directive.findAll("/b")).toHaveLength(1);
  });

  it("stays iterable as a plain Array<Directive>", () => {
    const directive = DON.parse(SERVER_TEXT);

    const match = directive.findAll("/server/router");

    expect(match).toBeInstanceOf(Array);
    expect(match.length).toBe(3);
    expect(match[0]!.name).toBe("router");

    const names: string[] = [];
    match.forEach((d) => names.push(String(d.args[0])));
    expect(names).toEqual(["/users", "/user/:user_id", "/admin"]);
  });
});

describe("Directive#findFirst", () => {
  it("returns the first directive matching the path", () => {
    const directive = DON.parse(SERVER_TEXT);

    const first = directive.findFirst("/server/router");

    expect(first?.args).toEqual(["/users"]);
  });

  it("returns undefined for an unmatched path", () => {
    const directive = DON.parse(SERVER_TEXT);

    expect(directive.findFirst("/server/unknown")).toBeUndefined();
  });

  it("returns undefined for an empty or root-only path", () => {
    const directive = DON.parse(SERVER_TEXT);

    expect(directive.findFirst("")).toBeUndefined();
    expect(directive.findFirst("/")).toBeUndefined();
  });
});

describe("Directive#map", () => {
  it("destructures args and receives the directive as the second argument", () => {
    const directive = DON.parse(SERVER_TEXT);
    const router = directive.findFirst("/server/router")!;
    const respond = router.findFirst("/respond")!;

    const result = respond.map(([statusCode, status]) => ({
      statusCode,
      status,
    }));

    expect(result).toEqual({ statusCode: 200, status: "Ok" });
  });

  it("passes the directive itself so callers can chain findAll/findFirst", () => {
    const directive = DON.parse(SERVER_TEXT);
    const router = directive.findFirst("/server/router")!;

    const childCount = router.map((args, self) => self.children.length);

    expect(childCount).toBe(1);
  });

  it("leaves missing destructured fields undefined instead of throwing", () => {
    const directive = new Directive("x", [1], []);
    const result = directive.map(([a, b]) => ({ a, b }));

    expect(result).toEqual({ a: 1, b: undefined });
  });
});

describe("ResultMatchDirectives#map", () => {
  it("applies fn(args, directive) to every matched directive", () => {
    const text = ""
      + 'server { respond 200 "Ok" }\n'
      + 'server { respond 403 "Forbidden" }\n';
    const directive = DON.parse(text);

    const result = directive
      .findAll("/server/respond")
      .map(([statusCode, status]) => ({ statusCode, status }));

    expect(result).toEqual([
      { statusCode: 200, status: "Ok" },
      { statusCode: 403, status: "Forbidden" },
    ]);
  });

  it("supports the combined nested-find example from the server/router/respond tree", () => {
    const directive = DON.parse(SERVER_TEXT);

    const result = directive
      .findAll("/server/router")
      .map(([path], router) =>
        router
          .findAll("/respond")
          .map(([statusCode, status]) => ({ statusCode, status })),
      );

    expect(result).toEqual([
      [{ statusCode: 200, status: "Ok" }],
      [{ statusCode: 200, status: "Ok" }],
      [{ statusCode: 403, status: "Forbidden" }],
    ]);
  });
});

describe("Directive#findAll with parameter filters", () => {
  it("filters a segment by its positional args using [value] syntax", () => {
    const directive = DON.parse(SERVER_TEXT);

    const match = directive.findAll("/server/router[/users]");

    expect(match).toHaveLength(1);
    expect(match[0]!.args).toEqual(["/users"]);
  });

  it("findFirst also supports the parameter filter", () => {
    const directive = DON.parse(SERVER_TEXT);

    const admin = directive.findFirst("/server/router[/admin]");

    expect(admin?.args).toEqual(["/admin"]);
  });

  it("returns no results when the name matches but the filter doesn't", () => {
    const directive = DON.parse(SERVER_TEXT);

    expect(directive.findAll("/server/router[/no-existe]")).toEqual([]);
  });
});
