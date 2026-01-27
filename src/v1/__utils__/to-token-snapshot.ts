import { expect } from "bun:test";
import * as fs from "node:fs";
import { Lexema } from "../compiler/lexema.js";
import { Token } from "../compiler/token.js";
import { Part } from "../compiler/part.js";
import { KeySyntaxKind } from "./key-syntax-kind.js";
import type { Span } from "../compiler/span.js";
import { PartSet } from "../compiler/part-set.js";
import { DirectiveNode, DocumentNode } from "../compiler/directive-node.js";
import { t } from "./t.js";
import { SyntaxParser } from "../compiler/syntax-encode.js";

const isObject = (value: unknown) =>
  typeof value === "object" && value !== null;
const isLexema = (value: unknown) => isObject(value) && value instanceof Lexema;
const isToken = (value: unknown) => isObject(value) && value instanceof Token;
const isPartSet = (value: unknown) =>
  isObject(value) && value instanceof PartSet;
const isPart = (value: unknown) => isObject(value) && value instanceof Part;
const isTokenArray = (received: unknown) =>
  typeof received === "object" &&
  Array.isArray(received) &&
  received.every(isToken);
const isNode = (value: unknown) =>
  isObject(value) && value instanceof DirectiveNode;
const isDocumentNode = (value: unknown) =>
  isObject(value) && value instanceof DocumentNode;
const isDirectiveArray = (value: unknown) =>
  isObject(value) && Array.isArray(value) && value.every(isNode);

const toSpanStr = (span: Span) => {
  const posStr = `Offset ${span.index} Len ${span.length}`;
  const i =
    span.startLocation && span.endLocation
      ? `; Ln ${span.startLocation.line + 1}, Col ${span.startLocation.column + 1} (Padding ${span.startLocation.paddingLine}) -> Ln ${span.endLocation.line + 1}, Col ${span.endLocation.column + 1} (Padding ${span.startLocation.paddingLine})`
      : "";

  return `${posStr}${i}`;
};

const toHex = function* (value: string | Iterable<number>) {
  const buff =
    typeof value === "string"
      ? new Uint8Array(new TextEncoder().encode(value))
      : value;
  const e = 16;

  const hexParts = Array.from(buff).reduce((list, n8, index) => {
    const col = Math.floor(index / e);
    const set = list.get(col) ?? new Set<[number, string]>();
    set.add([n8, n8.toString(16).padStart(2, "0").toUpperCase()]);
    list.set(col, set);
    return list;
  }, new Map<number, Set<[number, string]>>());

  let colIndex = -1;
  for (const col of hexParts.values()) {
    const i = (++colIndex).toString().padStart(4, " ");

    const hexLine = Array.from(col, ([u8, char]) => char)
      .join(" ")
      .padEnd(e * 3 - 1, " ");

    const asciiRepresentation = new TextDecoder().decode(
      new Uint8Array(
        Array.from(col, ([u8]) => (u8 === 0x0a ? [92, 110] : [u8])).flat(),
      ),
    );

    yield `${i}:  ${hexLine}  [${asciiRepresentation}]`;
  }
};

declare module "bun:test" {
  interface Matchers<T> {
    toTokenSnapshot(snapName: string): T;
  }
}

expect.extend({
  // to-token-snapshot
  toTokenSnapshot(received: unknown, spanName: string) {
    const lexema = isLexema(received) ? received : null;
    const document = lexema ? Lexema.debugGetDocument(lexema) : null;

    const snapPath = new URL(
      `${spanName}.snap`,
      new URL("../__tokens_snapshots__/", import.meta.url),
    );

    const jsonPath = new URL(
      `${spanName}.snap.json`,
      new URL("../__tokens_snapshots__/", import.meta.url),
    );

    fs.mkdirSync(new URL("./", snapPath), { recursive: true });

    const inspectTokens = (value: unknown): string => {
      const spaces: number | string = 2;
      const margin = typeof spaces === "number" ? " ".repeat(spaces) : spaces;

      function* lines(input: unknown, depth: number = 0): Generator<string> {
        const lineMargin = margin.repeat(depth);
        const nextLineMargin = margin.repeat(depth + 1);

        if (isLexema(input)) {
          if (document) {
            yield new TextDecoder().decode(document);
            yield "";
            yield "-".repeat(60);
            yield "";
            yield* toHex(document);
            yield "";
            yield "-".repeat(60);
            yield "";
          }
          for (const token of input.tokens) {
            yield* lines(token, depth);
          }
        }

        if (isToken(input)) {
          const token = input;
          const typeStr = KeySyntaxKind[token.type] ?? `Token<${token.type}>`;
          const span = token.span;

          const payload = document
            ? new TextDecoder().decode(
                document.subarray(span.index, span.index + span.length),
              )
            : null;

          const errorStr = input.getErrors().length
            ? ` - SyntaxError: ${input.getErrors().join(` `)}`
            : ``;

          yield `${lineMargin}Token: [${toSpanStr(span)}] ${typeStr} ${payload ? JSON.stringify(payload) : ""}${errorStr}`;

          for (const part of token.parts) {
            yield* lines(part, depth + 1);
          }
        }

        if (isPart(input)) {
          const part = input;
          const typeStr = KeySyntaxKind[part.type] ?? `Part<${part.type}>`;
          const span = part.span;
          const payload = new TextDecoder().decode(new Uint8Array(part.buffer));
          const payloadHex = Array.from(new Uint8Array(part.buffer), (e) =>
            e.toString(16).padStart(2, "0").toUpperCase(),
          ).join(" ");

          yield `${lineMargin}Part#${part.id}: [${toSpanStr(span)}] ${typeStr} [${payloadHex}] ${JSON.stringify(payload)}`;
        }

        if (isPartSet(input)) {
          const buff = new Uint8Array(
            input.parts.map((part) => part.buffer).flat(),
          );

          yield new TextDecoder().decode(buff);
          yield "";
          yield `-`.repeat(60);
          yield "";

          yield* toHex(buff);

          yield "";
          yield `-`.repeat(60);
          yield "";

          const partSet = input;
          for (const part of partSet.parts) {
            yield* lines(part, depth);
          }
        }

        if (isDirectiveArray(input)) {
          for (const directive of input) {
            yield* lines(directive, depth);
          }
        }

        if (isNode(input)) {
          const directiveNode = input;
          const name = directiveNode.name;

          yield `${lineMargin}Directive#${directiveNode.id}: ${name.text() ?? "<unnamed>"} [${toSpanStr(directiveNode.span)}]`;
          yield `${lineMargin}Name: [${toSpanStr(name.span)}] ${name.text()}`;
          if (directiveNode.args.length) {
            yield `${lineMargin}Args:`;
            for (const arg of directiveNode.args) {
              yield `${nextLineMargin}Arg: [${toSpanStr(arg.span)}] ${arg.text()}`;
            }
          }

          for (const child of directiveNode.children) {
            yield* lines(child, depth + 1);
          }
        }

        if (isDocumentNode(input)) {
          const payload = SyntaxParser.raw.get(input);

          if (typeof payload === "string") {
            yield payload;
            yield "-".repeat(60);
            yield ``;
            yield* toHex(payload);
            yield ``;
            yield "-".repeat(60);
            yield ``;
          }

          yield `Document: [${toSpanStr(input.span)}]`;
          yield* lines(input.children, depth + 1);
        }
      }

      return Array.from(lines(value)).join("\n") + "\n";
    };

    t(() => fs.writeFileSync(snapPath, inspectTokens(received)));
    t(() => fs.writeFileSync(jsonPath, JSON.stringify(received, null, 2)));

    return {
      pass: true,
    };
  },
});
