import { describe, it, expect } from "bun:test";
import { DON, Directive } from "./don";

describe("DON.parse", () => {
  it('should parse "test" and return a Directive with name "test"', () => {
    const result = DON.parse("test");

    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(1);
    expect(result[0]).toBeInstanceOf(Directive);
    expect(result[0]!.name).toBe("test");
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
});
