import { describe, it, expect } from "bun:test";
import { DON, Directive } from "./don";
import { DirectiveXMLEncoder, DirectiveXMLDecoder } from "./directive-xml";

describe("DirectiveXMLEncoder.encode", () => {
  it("encodes attributes and text content from a nested directive", () => {
    const directives = DON.parse(""
      + "div x-data=name {\n"
      + "  span key=key1 hello\n"
      + "}\n"
    );

    const xml = DirectiveXMLEncoder.encode(directives);

    expect(xml).toBe(""
      + '<div x-data="name">\n'
      + '  <span key="key1">hello</span>\n'
      + "</div>"
    );
  });

  it("self-closes elements with no children and no text", () => {
    const directives = DON.parse("input name=email");

    const xml = DirectiveXMLEncoder.encode(directives);

    expect(xml).toBe('<input name="email" />');
  });

  it("escapes special characters in attributes and text", () => {
    const directives = [
      new Directive("span", ["title=a & b", '<tag> "quoted"'], []),
    ];

    const xml = DirectiveXMLEncoder.encode(directives);

    expect(xml).toBe('<span title="a &amp; b">&lt;tag&gt; "quoted"</span>');
  });

  it("encodes multiple root directives joined by newlines", () => {
    const directives = DON.parse('br\nhr');

    const xml = DirectiveXMLEncoder.encode(directives);

    expect(xml).toBe("<br />\n<hr />");
  });
});

describe("DirectiveXMLDecoder.decode", () => {
  it("round-trips attributes and text content back into directives", () => {
    const xml = ""
      + '<div x-data="name">\n'
      + '  <span key="key1">hello</span>\n'
      + "</div>";

    const directives = DirectiveXMLDecoder.decode(xml);

    expect(directives).toEqual(DON.parse(""
      + "div x-data=name {\n"
      + "  span key=key1 hello\n"
      + "}\n"
    ));
  });

  it("decodes self-closing elements without text or children", () => {
    const directives = DirectiveXMLDecoder.decode('<input name="email" />');

    expect(directives).toHaveLength(1);
    expect(directives[0].name).toBe("input");
    expect(directives[0].args).toEqual(["name=email"]);
    expect(directives[0].children).toEqual([]);
  });

  it("decodes multiple root elements", () => {
    const directives = DirectiveXMLDecoder.decode("<br />\n<hr />");

    expect(directives.map((d) => d.name)).toEqual(["br", "hr"]);
  });

  it("unescapes entities in attributes and text", () => {
    const directives = DirectiveXMLDecoder.decode(
      '<span title="a &amp; b">&lt;tag&gt; "quoted"</span>',
    );

    expect(directives[0].args).toEqual(["title=a & b", '<tag> "quoted"']);
  });

  it("throws on mismatched closing tags", () => {
    expect(() => DirectiveXMLDecoder.decode("<div><span></div></span>")).toThrow();
  });
});

describe("DirectiveXML round-trip", () => {
  it("encode(decode(x)) is stable for nested structures", () => {
    const original = DON.parse(""
      + "ul {\n"
      + "  li id=first hello\n"
      + "  li id=second world\n"
      + "}\n"
    );

    const xml = DirectiveXMLEncoder.encode(original);
    const decoded = DirectiveXMLDecoder.decode(xml);

    expect(decoded).toEqual(original);
    expect(DirectiveXMLEncoder.encode(decoded)).toBe(xml);
  });
});
