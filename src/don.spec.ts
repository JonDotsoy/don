import { describe, it, expect } from "bun:test";
import { DON, Directive } from "./don";
import { donToParts } from "./index";

describe("DON.parse", () => {
  it('should parse "test" and return a Directive with name "test"', () => {
    const result = DON.parse("test");

    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(1);
    expect(result[0]).toBeInstanceOf(Directive);
    expect(result[0]!.name).toBe("test");
  });

  it('should parse identifiers with square brackets', () => {
    const result = DON.parse("[name]");

    expect(result).toHaveLength(1);
    expect(result[0]).toBeInstanceOf(Directive);
    expect(result[0]!.name).toBe("[name]");
  });

  it('should parse identifiers mixing hyphen and square brackets', () => {
    const result = DON.parse("my-[age]");

    expect(result).toHaveLength(1);
    expect(result[0]!.name).toBe("my-[age]");
  });

  it('should parse a bracketed identifier directive with a block', () => {
    const result = DON.parse(""
      + "route-[id] {\n"
      + '  handler "process"\n'
      + "}\n"
    );

    expect(result).toHaveLength(1);
    expect(result[0]!.name).toBe("route-[id]");
    expect(result[0]!.children).toHaveLength(1);
    expect(result[0]!.children[0]!.name).toBe("handler");
    expect(result[0]!.children[0]!.args).toEqual(["process"]);
  });

  it('should parse "foo biz true 1 {tar true}"', () => {
    const result = DON.parse(""
      + "foo biz true 1 {\n"
      + "  tar true\n"
      + "}\n"
    );

    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(1);
    expect(result[0]).toBeInstanceOf(Directive);
    expect(result[0]!.name).toBe("foo");
    expect(result[0]!.args).toEqual(["biz", true, 1]);
    expect(result[0]!.children[0]!.name).toEqual("tar");
    expect(result[0]!.children[0]!.args).toEqual([true]);
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
    
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(3);
    
    // First directive: name "@tar"
    expect(result[0]).toBeInstanceOf(Directive);
    expect(result[0]!.name).toBe("name");
    expect(result[0]!.args).toEqual(['@tar']);
    
    // Second directive: describe "A simple package manager for Node.js projects"
    expect(result[1]).toBeInstanceOf(Directive);
    expect(result[1]!.name).toBe("describe");
    expect(result[1]!.args).toEqual(['A simple package manager for Node.js projects']);
    
    // Third directive: dependencies { zod ">=1" react ">=5" }
    expect(result[2]).toBeInstanceOf(Directive);
    expect(result[2]!.name).toBe("dependencies");
    expect(result[2]!.children).toHaveLength(2);
    expect(result[2]!.children[0]!.name).toBe("zod");
    expect(result[2]!.children[0]!.args).toEqual(['>=1']);
    expect(result[2]!.children[1]!.name).toBe("react");
    expect(result[2]!.children[1]!.args).toEqual(['>=5']);
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
    
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(3);
    
    // First directive: name "my-app"
    expect(result[0]).toBeInstanceOf(Directive);
    expect(result[0]!.name).toBe("name");
    expect(result[0]!.args).toEqual(['my-app']);
    
    // Second directive: port 8080
    expect(result[1]).toBeInstanceOf(Directive);
    expect(result[1]!.name).toBe("port");
    expect(result[1]!.args).toEqual([8080]);
    
    // Third directive: database { host "localhost" port 5432 }
    expect(result[2]).toBeInstanceOf(Directive);
    expect(result[2]!.name).toBe("database");
    expect(result[2]!.children).toHaveLength(2);
    expect(result[2]!.children[0]!.name).toBe("host");
    expect(result[2]!.children[0]!.args).toEqual(['localhost']);
    expect(result[2]!.children[1]!.name).toBe("port");
    expect(result[2]!.children[1]!.args).toEqual([5432]);
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
    
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(2);
    
    // First directive: name "my-app"
    expect(result[0]).toBeInstanceOf(Directive);
    expect(result[0]!.name).toBe("name");
    expect(result[0]!.args).toEqual(['my-app']);
    
    // Second directive: server { host "0.0.0.0" port 8080 }
    expect(result[1]).toBeInstanceOf(Directive);
    expect(result[1]!.name).toBe("server");
    expect(result[1]!.children).toHaveLength(2);
    expect(result[1]!.children[0]!.name).toBe("host");
    expect(result[1]!.children[0]!.args).toEqual(['0.0.0.0']);
    expect(result[1]!.children[1]!.name).toBe("port");
    expect(result[1]!.children[1]!.args).toEqual([8080]);
  });
});

describe("JSON.stringify(DON.parse(...))", () => {
  it('serializes a flat directive using Directive#toJSON', () => {
    const result = DON.parse('name "my-package"');

    expect(JSON.parse(JSON.stringify(result))).toEqual([
      { name: "my-package" },
    ]);
  });

  it('serializes nested directives using Directive#toJSON', () => {
    const result = DON.parse(""
      + "server {\n"
      + '  host "localhost"\n'
      + "  port 8080\n"
      + "}\n"
    );

    expect(JSON.parse(JSON.stringify(result))).toEqual([
      { server: { host: "localhost", port: 8080 } },
    ]);
  });

  it('serializes multiple directives, one object per array entry', () => {
    const result = DON.parse(""
      + 'name "@tar"\n'
      + "dependencies {\n"
      + '  zod ">=1"\n'
      + "}\n"
    );

    expect(JSON.parse(JSON.stringify(result))).toEqual([
      { name: "@tar" },
      { dependencies: { zod: ">=1" } },
    ]);
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
