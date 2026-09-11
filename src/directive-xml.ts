import { Directive, HeredocValue } from "./don.js";

interface XMLAttribute {
  key: string;
  value: string;
}

const ATTRIBUTE_ARG_PATTERN = /^([A-Za-z_:][\w:.-]*)=([\s\S]*)$/;

const requireStringName = (name: string | symbol): string => {
  if (typeof name !== "string") {
    throw new Error(
      `Invalid directive: name must be a string, got ${String(name)}`,
    );
  }

  return name;
};

const argToText = (arg: number | string | boolean | HeredocValue): string =>
  arg instanceof HeredocValue ? arg.content : String(arg);

/**
 * Splits a directive's args into `key=value` attributes and the remaining
 * plain args, which become the element's text content.
 */
const splitArgs = (
  args: (number | string | boolean | HeredocValue)[],
): { attributes: XMLAttribute[]; text: string } => {
  const attributes: XMLAttribute[] = [];
  const textParts: string[] = [];

  for (const arg of args) {
    const match =
      typeof arg === "string" ? ATTRIBUTE_ARG_PATTERN.exec(arg) : null;

    if (match) {
      attributes.push({ key: match[1]!, value: match[2]! });
    } else {
      textParts.push(argToText(arg));
    }
  }

  return { attributes, text: textParts.join(" ") };
};

const escapeAttributeValue = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const escapeText = (value: string): string =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const renderAttributes = (attributes: XMLAttribute[]): string =>
  attributes
    .map(({ key, value }) => ` ${key}="${escapeAttributeValue(value)}"`)
    .join("");

const renderDirective = (
  directive: Directive,
  depth: number,
  indent: string,
): string => {
  const name = requireStringName(directive.name);
  const { attributes, text } = splitArgs(directive.args);
  const pad = indent.repeat(depth);
  const attrs = renderAttributes(attributes);

  if (directive.children.length === 0) {
    return text.length === 0
      ? `${pad}<${name}${attrs} />`
      : `${pad}<${name}${attrs}>${escapeText(text)}</${name}>`;
  }

  const lines = [
    ...(text.length > 0
      ? [`${indent.repeat(depth + 1)}${escapeText(text)}`]
      : []),
    ...directive.children.map((child) =>
      renderDirective(child, depth + 1, indent),
    ),
  ];

  return `${pad}<${name}${attrs}>\n${lines.join("\n")}\n${pad}</${name}>`;
};

export interface DirectiveXMLEncoderOptions {
  /** Defaults to two spaces. */
  indent?: string;
}

export class DirectiveXMLEncoder {
  encode(
    directives: Directive[],
    options: DirectiveXMLEncoderOptions = {},
  ): string {
    const { indent = "  " } = options;

    return directives
      .map((directive) => renderDirective(directive, 0, indent))
      .join("\n");
  }

  static encode(
    directives: Directive[],
    options: DirectiveXMLEncoderOptions = {},
  ): string {
    return new DirectiveXMLEncoder().encode(directives, options);
  }
}

interface XMLElement {
  name: string;
  attributes: XMLAttribute[];
  children: XMLElement[];
  text: string;
}

const isNameStartChar = (char: string | undefined): boolean =>
  char !== undefined && /[A-Za-z_:]/.test(char);

const isNameChar = (char: string | undefined): boolean =>
  char !== undefined && /[A-Za-z0-9_:.-]/.test(char);

const isWhitespace = (char: string | undefined): boolean =>
  char !== undefined && /\s/.test(char);

const decodeEntities = (value: string): string =>
  value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");

class XMLCursor {
  pos = 0;
  constructor(readonly text: string) {}

  peek(): string | undefined {
    return this.text[this.pos];
  }

  eof(): boolean {
    return this.pos >= this.text.length;
  }

  skipWhitespace(): void {
    while (isWhitespace(this.peek())) this.pos++;
  }
}

const readName = (cursor: XMLCursor): string => {
  const start = cursor.pos;

  if (!isNameStartChar(cursor.peek())) {
    throw new Error(
      `Invalid DirectiveXML: expected a name at position ${cursor.pos}`,
    );
  }

  cursor.pos++;
  while (isNameChar(cursor.peek())) cursor.pos++;

  return cursor.text.slice(start, cursor.pos);
};

const readAttributes = (cursor: XMLCursor): XMLAttribute[] => {
  const attributes: XMLAttribute[] = [];

  while (true) {
    cursor.skipWhitespace();
    const char = cursor.peek();
    if (char === undefined || char === "/" || char === ">") break;

    const key = readName(cursor);
    cursor.skipWhitespace();

    if (cursor.peek() !== "=") {
      throw new Error(
        `Invalid DirectiveXML: expected "=" after attribute "${key}"`,
      );
    }
    cursor.pos++;
    cursor.skipWhitespace();

    const quote = cursor.peek();
    if (quote !== '"' && quote !== "'") {
      throw new Error(
        `Invalid DirectiveXML: expected a quoted value for attribute "${key}"`,
      );
    }
    cursor.pos++;

    const start = cursor.pos;
    while (!cursor.eof() && cursor.peek() !== quote) cursor.pos++;

    if (cursor.eof()) {
      throw new Error(
        `Invalid DirectiveXML: unterminated value for attribute "${key}"`,
      );
    }

    attributes.push({
      key,
      value: decodeEntities(cursor.text.slice(start, cursor.pos)),
    });
    cursor.pos++;
  }

  return attributes;
};

const parseXMLElement = (cursor: XMLCursor): XMLElement => {
  if (cursor.peek() !== "<") {
    throw new Error(
      `Invalid DirectiveXML: expected "<" at position ${cursor.pos}`,
    );
  }
  cursor.pos++;

  const name = readName(cursor);
  const attributes = readAttributes(cursor);
  cursor.skipWhitespace();

  if (cursor.peek() === "/") {
    cursor.pos++;
    if (cursor.peek() !== ">") {
      throw new Error(
        `Invalid DirectiveXML: expected ">" to self-close "${name}"`,
      );
    }
    cursor.pos++;

    return { name, attributes, children: [], text: "" };
  }

  if (cursor.peek() !== ">") {
    throw new Error(`Invalid DirectiveXML: expected ">" after tag "${name}"`);
  }
  cursor.pos++;

  const children: XMLElement[] = [];
  const textParts: string[] = [];

  while (true) {
    if (cursor.eof()) {
      throw new Error(`Invalid DirectiveXML: unterminated element "${name}"`);
    }

    if (cursor.peek() === "<") {
      if (cursor.text.startsWith("</", cursor.pos)) {
        cursor.pos += 2;
        const closeName = readName(cursor);

        if (closeName !== name) {
          throw new Error(
            `Invalid DirectiveXML: expected closing tag "</${name}>" but got "</${closeName}>"`,
          );
        }

        cursor.skipWhitespace();
        if (cursor.peek() !== ">") {
          throw new Error(
            `Invalid DirectiveXML: expected ">" to close "${name}"`,
          );
        }
        cursor.pos++;
        break;
      }

      children.push(parseXMLElement(cursor));
      continue;
    }

    const start = cursor.pos;
    while (!cursor.eof() && cursor.peek() !== "<") cursor.pos++;
    const raw = decodeEntities(cursor.text.slice(start, cursor.pos)).trim();
    if (raw.length > 0) textParts.push(raw);
  }

  return { name, attributes, children, text: textParts.join(" ") };
};

const parseXML = (source: string): XMLElement[] => {
  const cursor = new XMLCursor(source);
  const elements: XMLElement[] = [];

  cursor.skipWhitespace();
  while (!cursor.eof()) {
    elements.push(parseXMLElement(cursor));
    cursor.skipWhitespace();
  }

  return elements;
};

const attributeToArg = ({ key, value }: XMLAttribute): string =>
  `${key}=${value}`;

const xmlElementToDirective = (element: XMLElement): Directive => {
  const args = element.attributes.map(attributeToArg);
  if (element.text.length > 0) args.push(element.text);

  return new Directive(
    element.name,
    args,
    element.children.map(xmlElementToDirective),
  );
};

export class DirectiveXMLDecoder {
  decode(source: string): Directive[] {
    return parseXML(source).map(xmlElementToDirective);
  }

  static decode(source: string): Directive[] {
    return new DirectiveXMLDecoder().decode(source);
  }
}
