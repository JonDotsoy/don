import { Charset } from "../utils/charset.js";
import { CharsetTools } from "../utils/charset-tools.js";
import { SyntaxKind } from "../utils/syntax-kind.js";
import type { u8 } from "../types/u8.js";
import { Span } from "./span.js";
import type { Location } from "../types/location.js";
import { PartialSpan } from "./partial-span.js";

const cursorUid = { current: -1 };
const uid = () => ++cursorUid.current;

type PartScanOptions = {
  readonly describeLocation?: (
    span: Span,
    start: Location,
    end: Location,
  ) => void;
};

export class Part {
  id = uid();

  constructor(
    readonly type: SyntaxKind,
    readonly buffer: u8,
    readonly span: Span,
  ) {}

  toUint8Array() {
    return new Uint8Array(this.buffer);
  }

  toText() {
    return new TextDecoder().decode(this.toUint8Array());
  }

  toJSON() {
    return {
      type: this.type,
      text: this.toText(),
      span: this.span,
    };
  }

  static matches: [
    type: SyntaxKind,
    charset: u8,
    options?: { limit?: number },
  ][] = [
    [SyntaxKind.alphabet, CharsetTools.alphabetCharts],
    [SyntaxKind.integer, CharsetTools.numericCharts],
    [SyntaxKind.whitespace, CharsetTools.whitespaceCharts],
    [SyntaxKind.newline, CharsetTools.newlineCharts],
    // .: dot
    [SyntaxKind.dot, CharsetTools.dotCharts],
    // _: underscore
    [SyntaxKind.underscore, CharsetTools.underscoreCharts],
    // {:
    [SyntaxKind.openCurlyBrace, CharsetTools.openCurlyBraceCharts],
    // }:
    [SyntaxKind.closeCurlyBrace, CharsetTools.closeCurlyBraceCharts],
    // quote
    [SyntaxKind.singleQuote, CharsetTools.singleQuoteCharts, { limit: 1 }],
    [SyntaxKind.doubleQuote, CharsetTools.doubleQuoteCharts, { limit: 1 }],
  ];

  static scan(buffer: u8, options?: PartScanOptions) {
    const charset = new Charset(buffer);
    let currentPos = 0;
    const parts: Part[] = [];
    const matches = this.matches;
    let paddingLine = 0;
    let currentLine = 0;
    let currentColumn = 0;
    let newLineBreak = SyntaxKind.newline;

    const findNextToken = (currentPos: number) => {
      for (const [type, u8, options] of matches) {
        const span = charset.span(u8, currentPos, options?.limit);
        if (span) return { type: type, span: span, columnWidth: span.length };
      }
      const overflowing = currentPos >= buffer.length;
      if (overflowing) return null;
      // default next char as unknown. `buffer` is scanned one byte at a
      // time here, but a UTF-8 continuation byte (10xxxxxx) is the tail of
      // a multi-byte character the charsets above never match as a whole
      // (they're ASCII-only) — attributing it its own column would count
      // one on-screen character as 2-4 columns. Give it a `columnWidth` of
      // 0 so only the sequence's lead byte advances the column, once.
      const byte = buffer[currentPos]!;
      const isUtf8ContinuationByte = (byte & 0xc0) === 0x80;
      return {
        type: SyntaxKind.unknown,
        span: new PartialSpan(currentPos, 1),
        columnWidth: isUtf8ContinuationByte ? 0 : 1,
      };
    };

    while (true) {
      const nextToken = findNextToken(currentPos);
      if (!nextToken) break;
      const startLin = currentLine;
      const startCol = currentColumn;
      currentPos = nextToken.span.index + nextToken.span.length;
      currentColumn += nextToken.columnWidth;
      if (nextToken.type === SyntaxKind.whitespace && startCol === 0) {
        paddingLine += nextToken.span.length;
      }
      const startPaddingLine = paddingLine;
      if (nextToken.type === newLineBreak) {
        paddingLine = 0;
        currentLine += nextToken.span.length;
        currentColumn = 0;
      }
      const endPaddingLine = paddingLine;
      const endLin = currentLine;
      const endCol = currentColumn;

      const startLocation: Location = {
        line: startLin,
        column: startCol,
        paddingLine: startPaddingLine,
      };
      const endLocation: Location = {
        line: endLin,
        column: endCol,
        paddingLine: endPaddingLine,
      };

      const span = new Span(
        nextToken.span.index,
        nextToken.span.length,
        startLocation,
        endLocation,
      );

      options?.describeLocation?.(span, startLocation, endLocation);

      parts.push(
        new Part(
          nextToken.type,
          charset.slice(nextToken.span.index, currentPos),
          span,
        ),
      );
    }

    return parts;
  }
}
