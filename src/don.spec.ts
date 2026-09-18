import { describe, it, expect } from "bun:test";
import { DON, Directive, HeredocValue } from "./don";
import { ROOT_DIRECTIVE_NAME } from "./directive-json";
import { donToParts } from "./index";

describe("DON.parse", () => {
  it("should return an empty root Directive for empty input", () => {
    const result = DON.parse("");

    expect(result.name).toBe(ROOT_DIRECTIVE_NAME);
    expect(result.args).toEqual([]);
    expect(result.children).toEqual([]);
  });

  it("should return an empty root Directive for comment-only input", () => {
    const result = DON.parse("# just a comment\n");

    expect(result.name).toBe(ROOT_DIRECTIVE_NAME);
    expect(result.args).toEqual([]);
    expect(result.children).toEqual([]);
  });

  it('should parse "test" and return a Directive with name "test"', () => {
    const result = DON.parse("test");

    expect(result).toBeInstanceOf(Directive);
    expect(result.name).toBe("test");
  });

  it('should parse identifiers with square brackets', () => {
    const result = DON.parse("[name]");

    expect(result).toBeInstanceOf(Directive);
    expect(result.name).toBe("[name]");
  });

  it('should parse identifiers mixing hyphen and square brackets', () => {
    const result = DON.parse("my-[age]");

    expect(result.name).toBe("my-[age]");
  });

  it('should parse a bracketed identifier directive with a block', () => {
    const result = DON.parse(""
      + "route-[id] {\n"
      + '  handler "process"\n'
      + "}\n"
    );

    expect(result.name).toBe("route-[id]");
    expect(result.children).toHaveLength(1);
    expect(result.children[0]!.name).toBe("handler");
    expect(result.children[0]!.args).toEqual(["process"]);
  });

  it('should parse "foo biz true 1 {tar true}"', () => {
    const result = DON.parse(""
      + "foo biz true 1 {\n"
      + "  tar true\n"
      + "}\n"
    );

    expect(result).toBeInstanceOf(Directive);
    expect(result.name).toBe("foo");
    expect(result.args).toEqual(["biz", true, 1]);
    expect(result.children[0]!.name).toEqual("tar");
    expect(result.children[0]!.args).toEqual([true]);
  });

  it('should parse multiple directives with strings and nested objects', () => {
    const text = ""
      + 'name "@tar"\n'
      + 'describe "A simple package manager for Node.js projects"\n'
      + 'dependencies {\n'
      + '  zod ">=1"\n'
      + '  react ">=5"\n'
      + '}\n';

    const result = DON.parse(text);

    expect(result.name).toBe(ROOT_DIRECTIVE_NAME);
    expect(result.children).toHaveLength(3);

    // First directive: name "@tar"
    expect(result.children[0]).toBeInstanceOf(Directive);
    expect(result.children[0]!.name).toBe("name");
    expect(result.children[0]!.args).toEqual(['@tar']);

    // Second directive: describe "A simple package manager for Node.js projects"
    expect(result.children[1]).toBeInstanceOf(Directive);
    expect(result.children[1]!.name).toBe("describe");
    expect(result.children[1]!.args).toEqual(['A simple package manager for Node.js projects']);

    // Third directive: dependencies { zod ">=1" react ">=5" }
    expect(result.children[2]).toBeInstanceOf(Directive);
    expect(result.children[2]!.name).toBe("dependencies");
    expect(result.children[2]!.children).toHaveLength(2);
    expect(result.children[2]!.children[0]!.name).toBe("zod");
    expect(result.children[2]!.children[0]!.args).toEqual(['>=1']);
    expect(result.children[2]!.children[1]!.name).toBe("react");
    expect(result.children[2]!.children[1]!.args).toEqual(['>=5']);
  });

  it('should parse directives with inline comments', () => {
    const text = ""
      + '# Configuration file\n'
      + 'name "my-app" # Application name\n'
      + 'port 8080 # Default port\n'
      + '# Database settings\n'
      + 'database {\n'
      + '  host "localhost" # DB host\n'
      + '  port 5432\n'
      + '}\n';

    const result = DON.parse(text);

    expect(result.name).toBe(ROOT_DIRECTIVE_NAME);
    expect(result.children).toHaveLength(3);

    // First directive: name "my-app"
    expect(result.children[0]).toBeInstanceOf(Directive);
    expect(result.children[0]!.name).toBe("name");
    expect(result.children[0]!.args).toEqual(['my-app']);

    // Second directive: port 8080
    expect(result.children[1]).toBeInstanceOf(Directive);
    expect(result.children[1]!.name).toBe("port");
    expect(result.children[1]!.args).toEqual([8080]);

    // Third directive: database { host "localhost" port 5432 }
    expect(result.children[2]).toBeInstanceOf(Directive);
    expect(result.children[2]!.name).toBe("database");
    expect(result.children[2]!.children).toHaveLength(2);
    expect(result.children[2]!.children[0]!.name).toBe("host");
    expect(result.children[2]!.children[0]!.args).toEqual(['localhost']);
    expect(result.children[2]!.children[1]!.name).toBe("port");
    expect(result.children[2]!.children[1]!.args).toEqual([5432]);
  });

  it('should parse directives with block comments', () => {
    const text = ""
      + '/* Main configuration */\n'
      + 'name "my-app"\n'
      + '/* \n'
      + ' * Server settings\n'
      + ' * Port and host configuration\n'
      + ' */\n'
      + 'server {\n'
      + '  host "0.0.0.0" /* Listen on all interfaces */\n'
      + '  port 8080\n'
      + '}\n';

    const result = DON.parse(text);

    expect(result.name).toBe(ROOT_DIRECTIVE_NAME);
    expect(result.children).toHaveLength(2);

    // First directive: name "my-app"
    expect(result.children[0]).toBeInstanceOf(Directive);
    expect(result.children[0]!.name).toBe("name");
    expect(result.children[0]!.args).toEqual(['my-app']);

    // Second directive: server { host "0.0.0.0" port 8080 }
    expect(result.children[1]).toBeInstanceOf(Directive);
    expect(result.children[1]!.name).toBe("server");
    expect(result.children[1]!.children).toHaveLength(2);
    expect(result.children[1]!.children[0]!.name).toBe("host");
    expect(result.children[1]!.children[0]!.args).toEqual(['0.0.0.0']);
    expect(result.children[1]!.children[1]!.name).toBe("port");
    expect(result.children[1]!.children[1]!.args).toEqual([8080]);
  });

  it('should parse a heredoc argument into a HeredocValue', () => {
    const result = DON.parse(""
      + "server {\n"
      + "  response <<<HTML\n"
      + "    <html>\n"
      + "      <body>Content</body>\n"
      + "    </html>\n"
      + "  handler\n"
      + "}\n"
    );

    const response = result.children[0]!;
    expect(response.name).toBe("response");
    expect(response.args[0]).toBeInstanceOf(HeredocValue);
    expect(response.args[0]).toEqual(
      new HeredocValue("HTML", "<html>\n  <body>Content</body>\n</html>\n"),
    );

    // A heredoc always spans to the end of its own (dedented) line, so
    // whatever follows at the same indentation is a sibling directive,
    // not another arg of `response`.
    const handler = result.children[1]!;
    expect(handler.name).toBe("handler");
    expect(handler.args).toEqual([]);
  });

  it('should parse a heredoc argument without a delimiter', () => {
    const result = DON.parse(""
      + "step <<<\n"
      + "    npm ci\n"
    );

    expect(result.args[0]).toEqual(new HeredocValue(null, "npm ci\n"));
  });

  // Known bug (see docs/specs/v1/spec.md § 2.8 "Heredocs" -> Rules): "Content
  // must have greater indentation than the heredoc declaration" and parsing
  // "Continues until a token with indentation equal to or less than the
  // heredoc declaration line is found". Here `bar` sits at the same
  // indentation (0) as the `foo <<<EOF` declaration, so per spec it should
  // never enter the heredoc payload and should instead become `foo`'s
  // sibling directive - exactly like `baz` correctly does one line later.
  // Instead the parser unconditionally swallows the first content line
  // into the heredoc regardless of its indentation.
  it('should not swallow an unindented first line into the heredoc payload', () => {
    const result = DON.parse(""
      + "foo <<<EOF\n"
      + "bar\n"
      + "baz\n"
    );

    const foo = result.children[0]!;
    expect(foo.name).toBe("foo");
    expect(foo.args[0]).toEqual(new HeredocValue("EOF", ""));

    const bar = result.children[1]!;
    expect(bar.name).toBe("bar");
    expect(bar.args).toEqual([]);

    const baz = result.children[2]!;
    expect(baz.name).toBe("baz");
    expect(baz.args).toEqual([]);
  });

  // Known bug: the lexer (src/v1/compiler/token.ts) already detects and
  // records a "SyntaxError: Unclosed string" on the offending token (as
  // seen in src/v1/__tokens_snapshots__/identifier-single-quoted-multiline-escaped-identifier.snap
  // for a similar case), via Token#getErrors(). But DON.parse never reads
  // that back - getErrors() is only ever consulted by the debug token-
  // snapshot util (src/v1/__utils__/to-token-snapshot.ts), not by the
  // syntax parser (src/v1/compiler/syntax-encode.ts) or DON.parse itself.
  // So an unterminated string silently produces a corrupted directive
  // tree (the leading quote leaks into the arg value as a literal
  // character) instead of raising a syntax error.
  it('should raise a syntax error for an unterminated string instead of silently corrupting the arg', () => {
    expect(() => DON.parse('name "foo')).toThrow();
  });

  it('should raise a syntax error for an unterminated string inside a block', () => {
    expect(() => DON.parse(""
      + "server {\n"
      + '  host "localhost\n'
      + "}\n"
    )).toThrow();
  });

  it('should raise a syntax error for an unterminated string alongside other directives', () => {
    expect(() => DON.parse(""
      + 'name "my-app"\n'
      + 'version "1.0.0\n'
      + 'port 8080\n'
    )).toThrow();
  });

  it('should still parse properly terminated strings without throwing', () => {
    expect(() => DON.parse('name "foo"')).not.toThrow();
    expect(() => DON.parse("name 'foo'")).not.toThrow();
    expect(() => DON.parse('name "foo \\" bar"')).not.toThrow();
    expect(() => DON.parse(""
      + "server {\n"
      + '  host "localhost"\n'
      + "}\n"
    )).not.toThrow();
  });

  // Known bug: docs/specs/v1/spec.md § 2.2 documents this exact input under
  // "Constraint" / "Invalid" - "After a closing brace `}`, no additional
  // tokens are allowed on the same directive line (except newlines)" -
  // with the annotated error "Error: tokens after block close". The parser
  // never enforces it: `extra` is silently merged in as another arg of
  // `container`, right alongside its already-closed `{ ... }` block,
  // instead of raising a syntax error.
  it('should raise a syntax error for tokens after a block close on the same line', () => {
    expect(() => DON.parse('container { image "nginx" } extra')).toThrow();
  });
});

describe("DON.parse: special-character identifiers (spec § 2.3)", () => {
  // Every special symbol the spec calls out ($, -, /, :, [, ]) — alone and
  // combined into a single "kitchen sink" identifier — used first as a
  // directive NAME, then the exact same tokens used again as a bare
  // (unquoted) ARGUMENT of another directive, to prove the lexer accepts
  // them identically in both positions.
  it('should parse every special-character identifier from spec § 2.3 as a directive name', () => {
    const result = DON.parse(""
      + '$prod "on"\n'
      + '${name} "interpolation-like"\n'
      + '_private true\n'
      + 'myVariable-2 42\n'
      + '/api/:id GET 200\n'
      + '[flag]\n'
      + 'my-[age] 30\n'
      + 'route-[id]-[shape] "combo"\n'
      + 'path/to/resource "deep/path/value"\n'
      + 'ns:key:sub "colon-namespaced"\n'
      + 'a-b_c123$[x]:/y "kitchen-sink-name"\n'
    );

    const names = result.children.map((child) => child.name);
    expect(names).toEqual([
      "$prod",
      "${name}",
      "_private",
      "myVariable-2",
      "/api/:id",
      "[flag]",
      "my-[age]",
      "route-[id]-[shape]",
      "path/to/resource",
      "ns:key:sub",
      "a-b_c123$[x]:/y",
    ]);

    expect(result.children[0]!.args).toEqual(["on"]);
    expect(result.children[1]!.args).toEqual(["interpolation-like"]);
    expect(result.children[2]!.args).toEqual([true]);
    expect(result.children[3]!.args).toEqual([42]);
    expect(result.children[4]!.args).toEqual(["GET", 200]);
    expect(result.children[5]!.args).toEqual([]);
    expect(result.children[6]!.args).toEqual([30]);
    expect(result.children[7]!.args).toEqual(["combo"]);
    expect(result.children[8]!.args).toEqual(["deep/path/value"]);
    expect(result.children[9]!.args).toEqual(["colon-namespaced"]);
    expect(result.children[10]!.args).toEqual(["kitchen-sink-name"]);
  });

  it('should parse every special-character identifier from spec § 2.3 as a bare argument', () => {
    const result = DON.parse(""
      + "target $prod\n"
      + "template ${name}\n"
      + "route /api/:id\n"
      + "alias [name]\n"
      + "combo my-[age]\n"
      + "deep path/to/resource\n"
      + "key ns:key:sub\n"
      + "mixed a-b_c123$[x]:/y\n"
    );

    const asArg = Object.fromEntries(
      result.children.map((child) => [child.name, child.args[0]]),
    );

    expect(asArg).toEqual({
      target: "$prod",
      template: "${name}",
      route: "/api/:id",
      alias: "[name]",
      combo: "my-[age]",
      deep: "path/to/resource",
      key: "ns:key:sub",
      mixed: "a-b_c123$[x]:/y",
    });
  });
});

describe("JSON.stringify(DON.parse(...))", () => {
  it('serializes a flat directive using Directive#toJSON', () => {
    const result = DON.parse('name "my-package"');

    expect(JSON.parse(JSON.stringify(result))).toEqual({
      name: "my-package",
    });
  });

  it('serializes nested directives using Directive#toJSON', () => {
    const result = DON.parse(""
      + "server {\n"
      + '  host "localhost"\n'
      + "  port 8080\n"
      + "}\n"
    );

    expect(JSON.parse(JSON.stringify(result))).toEqual({
      server: { host: "localhost", port: 8080 },
    });
  });

  it('serializes multiple top-level directives into one merged object', () => {
    const result = DON.parse(""
      + 'name "@tar"\n'
      + "dependencies {\n"
      + '  zod ">=1"\n'
      + "}\n"
    );

    expect(JSON.parse(JSON.stringify(result))).toEqual({
      name: "@tar",
      dependencies: { zod: ">=1" },
    });
  });

  it('serializes a HeredocValue arg as its content string', () => {
    const result = DON.parse(""
      + "server {\n"
      + "  response <<<HTML\n"
      + "    <html></html>\n"
      + "  handler\n"
      + "}\n"
    );

    expect(JSON.parse(JSON.stringify(result))).toEqual({
      server: {
        response: "<html></html>\n",
        handler: [],
      },
    });
  });
});

describe("HeredocValue custom inspect", () => {
  it("hides toString/toJSON and keeps the HeredocValue tag", () => {
    const heredoc = new HeredocValue("HTML", "<div></div>\n");

    const inspected = Bun.inspect(heredoc);

    expect(inspected).toContain("HeredocValue");
    expect(inspected).toContain('delimiter: "HTML"');
    expect(inspected).not.toContain("toJSON");
    expect(inspected).not.toContain("toString");
  });
});

describe("Directive custom inspect", () => {
  it("hides toJSON and keeps the Directive tag", () => {
    const directive = new Directive("host", ["localhost"], []);

    const inspected = Bun.inspect(directive);

    expect(inspected).toContain("Directive");
    expect(inspected).toContain('name: "host"');
    expect(inspected).toContain('args: [ "localhost" ]');
    expect(inspected).not.toContain("toJSON");
  });

  it("hides toJSON on nested children too", () => {
    const directive = new Directive("server", [], [
      new Directive("host", ["localhost"], []),
    ]);

    const inspected = Bun.inspect(directive);

    expect(inspected).not.toContain("toJSON");
  });
});

describe("donToParts", () => {
  it('should parse simple identifier', () => {
    const text = "test";
    const result = donToParts(text);
    expect(result.map(p => p.value).join('')).toBe(text);
    expect(result).toMatchSnapshot();
  });

  it('should parse directive with string arguments', () => {
    const text = 'name "my-package"';
    const result = donToParts(text);
    expect(result.map(p => p.value).join('')).toBe(text);
    expect(result).toMatchSnapshot();
  });

  it('should parse directive with mixed arguments', () => {
    const text = 'foo bar true 42 "hello world"';
    const result = donToParts(text);
    expect(result.map(p => p.value).join('')).toBe(text);
    expect(result).toMatchSnapshot();
  });

  it('should parse directive with curly braces', () => {
    const text = 'config { port 8080 }';
    const result = donToParts(text);
    expect(result.map(p => p.value).join('')).toBe(text);
    expect(result).toMatchSnapshot();
  });

  it('should parse multiple directives with nested structure', () => {
    const text = ""
      + 'server {\n'
      + '  host "localhost"\n'
      + '  port 3000\n'
      + '}\n'
      + 'database {\n'
      + '  type "postgres"\n'
      + '}';
    const result = donToParts(text);
    expect(result.map(p => p.value).join('')).toBe(text);
    expect(result).toMatchSnapshot();
  });

  it('should parse router configuration with routes', () => {
    const text = ""
      + 'router {\n'
      + '  route /api {\n'
      + '    proxy http://backend:8080\n'
      + '    timeout 30\n'
      + '  }\n'
      + '  route /static {\n'
      + '    root /var/www\n'
      + '    cache true\n'
      + '  }\n'
      + '}';
    const result = donToParts(text);
    expect(result.map(p => p.value).join('')).toBe(text);
    expect(result).toMatchSnapshot();
  });

  it('should parse directive with line comment', () => {
    const text = '# This is a comment\nname "my-package"';
    const result = donToParts(text);
    expect(result.map(p => p.value).join('')).toBe(text);
    expect(result).toMatchSnapshot();
  });

  it('should parse directive with inline comment', () => {
    const text = 'port 8080 # Default port';
    const result = donToParts(text);
    expect(result.map(p => p.value).join('')).toBe(text);
    expect(result).toMatchSnapshot();
  });

  it('should parse multiple directives with comments', () => {
    const text = ""
      + '# Server configuration\n'
      + 'host "localhost"\n'
      + 'port 3000 # HTTP port\n'
      + '# Database settings\n'
      + 'database "postgres"';
    const result = donToParts(text);
    expect(result.map(p => p.value).join('')).toBe(text);
    expect(result).toMatchSnapshot();
  });

  it('should parse nested structure with comments', () => {
    const text = ""
      + '# Main server block\n'
      + 'server {\n'
      + '  # Network settings\n'
      + '  host "0.0.0.0"\n'
      + '  port 8080 # Listen port\n'
      + '  \n'
      + '  # Security options\n'
      + '  ssl true\n'
      + '}';
    const result = donToParts(text);
    expect(result.map(p => p.value).join('')).toBe(text);
    expect(result).toMatchSnapshot();
  });

  it('should parse block comment', () => {
    const text = '/* This is a block comment */\nname "test"';
    const result = donToParts(text);
    expect(result.map(p => p.value).join('')).toBe(text);
    expect(result).toMatchSnapshot();
  });

  it('should parse multiline block comment', () => {
    const text = ""
      + '/*\n'
      + ' * Configuration file\n'
      + ' * Author: John Doe\n'
      + ' */\n'
      + 'version "1.0.0"';
    const result = donToParts(text);
    expect(result.map(p => p.value).join('')).toBe(text);
    expect(result).toMatchSnapshot();
  });

  it('should parse mixed comments with directives', () => {
    const text = ""
      + '/* Global settings */\n'
      + 'app "my-app"\n'
      + '# Environment\n'
      + 'env "production"\n'
      + '\n'
      + '/* Database configuration */\n'
      + 'database {\n'
      + '  # Connection string\n'
      + '  url "postgres://localhost"\n'
      + '  pool 10 # Max connections\n'
      + '}';
    const result = donToParts(text);
    expect(result.map(p => p.value).join('')).toBe(text);
    expect(result).toMatchSnapshot();
  });

  it('should parse comments between nested blocks', () => {
    const text = ""
      + 'router {\n'
      + '  # API routes\n'
      + '  route /api {\n'
      + '    proxy http://backend:8080\n'
      + '  }\n'
      + '  \n'
      + '  # Static files\n'
      + '  route /static {\n'
      + '    root /var/www\n'
      + '  }\n'
      + '}';
    const result = donToParts(text);
    expect(result.map(p => p.value).join('')).toBe(text);
    expect(result).toMatchSnapshot();
  });

  it('should parse empty lines with comments', () => {
    const text = ""
      + '# Header comment\n'
      + '\n'
      + '# Another comment\n'
      + '\n'
      + 'name "test"\n'
      + '\n'
      + '# Footer comment';
    const result = donToParts(text);
    expect(result.map(p => p.value).join('')).toBe(text);
    expect(result).toMatchSnapshot();
  });

  it('should parse comment with special characters', () => {
    const text = '# TODO: Fix this @bug #123 (priority: high!)\nstatus "pending"';
    const result = donToParts(text);
    expect(result.map(p => p.value).join('')).toBe(text);
    expect(result).toMatchSnapshot();
  });

  it('should parse unclosed block comment', () => {
    const text = '/* This comment is not closed\nname "test"';
    const result = donToParts(text);
    expect(result.map(p => p.value).join('')).toBe(text);
    expect(result).toMatchSnapshot();
  });

  it('should parse nested block-like content in block comment', () => {
    const text = '/* Comment with /* nested */ symbols */\nport 3000';
    const result = donToParts(text);
    expect(result.map(p => p.value).join('')).toBe(text);
    expect(result).toMatchSnapshot();
  });
});

describe("Directive#parent", () => {
  it("is the immediate parent of a nested directive", () => {
    const root = DON.parse(""
      + "directivename {\n"
      + "  subdirective\n"
      + "}\n"
    );

    const subdirective = root.find("/directivename/subdirective")!;

    expect(subdirective.parent).toBe(root);
  });

  it("is undefined for a directive with no enclosing parent", () => {
    const root = DON.parse("test");

    expect(root.parent).toBeUndefined();
  });

  it("is the synthetic root for each top-level directive when parsing multiple", () => {
    const root = DON.parse(""
      + "name \"my-app\"\n"
      + "port 8080\n"
    );

    expect(root.name).toBe(ROOT_DIRECTIVE_NAME);
    for (const child of root.children) {
      expect(child.parent).toBe(root);
    }
  });

  it("is undefined for a Directive built by hand", () => {
    const parent = new Directive("parent", [], [new Directive("child", [])]);

    expect(parent.parent).toBeUndefined();
    expect(parent.children[0]!.parent).toBe(parent);
  });
});
