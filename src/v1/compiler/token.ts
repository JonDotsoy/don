import { SyntaxKind } from "../utils/syntax-kind.js";
import { findIndex, takeWhile } from "../utils/take-while.js";
import type { Part } from "./part.js";
import type { PartSet } from "./part-set.js";
import { Span } from "./span.js";
import { partsMatch } from "../utils/parts-match.js";

type MatchOptions = {
  /**
   * whether the token should be invisible in output (e.g. whitespace tokens)
   * @default false
   */
  invisible?: boolean;
  /**
   * a function that takes a part set and an index and returns a span
   * if the pattern matches at that index, or null if it doesn't
   */
  transform?: (token: Token) => Token;
};

export type TokenOptions = {
  /**
   * whether invisible tokens (e.g. whitespace) should be included in the output
   * @default false
   */
  showInvisibleTokens?: boolean;
};

export class Token {
  constructor(
    readonly type: SyntaxKind,
    readonly parts: Part[],
    readonly span: Span,
  ) {}

  static matches: [
    kind: SyntaxKind,
    pattern: (
      partSet: PartSet,
      fromIndex: number,
    ) => { span: Span; errors?: any[] } | null,
    options?: MatchOptions,
  ][] = [
    [
      SyntaxKind.comment,
      (
        partSet: PartSet,
        fromIndex: number = 0,
      ): { span: Span; errors?: any[] } | null => {
        const errors: string[] = [];
        const firstPart = partSet.parts[fromIndex];
        const secondPart = partSet.parts[fromIndex + 1];

        // Check for block comment: /* ... */
        // 0x2f = '/', 0x2a = '*'
        const isBlockCommentStart =
          firstPart?.buffer.length === 1 &&
          firstPart.buffer[0] === 0x2f &&
          secondPart?.buffer.length === 1 &&
          secondPart.buffer[0] === 0x2a;

        if (isBlockCommentStart) {
          const parts = [firstPart, secondPart];
          let currentIndex = fromIndex + 2;
          let foundClosing = false;

          // Find closing */
          while (currentIndex < partSet.parts.length) {
            const currentPart = partSet.parts[currentIndex];
            const nextPart = partSet.parts[currentIndex + 1];

            if (!currentPart) break;

            parts.push(currentPart);

            // Check if we found */
            if (
              currentPart.buffer.length === 1 &&
              currentPart.buffer[0] === 0x2a &&
              nextPart?.buffer.length === 1 &&
              nextPart.buffer[0] === 0x2f
            ) {
              parts.push(nextPart);
              foundClosing = true;
              break;
            }

            currentIndex++;
          }

          if (!foundClosing) {
            errors.push("Unclosed block comment");
          }

          const lastPart = parts[parts.length - 1]!;

          return {
            span: new Span(
              fromIndex,
              parts.length,
              firstPart.span.startLocation,
              lastPart.span.endLocation,
            ),
            errors: errors.length ? errors : undefined,
          };
        }

        // Check for line comment: # ...
        // 0x23 = '#'
        const isLineComment =
          firstPart?.buffer.length === 1 && firstPart.buffer[0] === 0x23;

        if (isLineComment) {
          // Find all parts until newline or end of file
          const parts = [firstPart];
          let currentIndex = fromIndex + 1;

          while (currentIndex < partSet.parts.length) {
            const currentPart = partSet.parts[currentIndex];
            if (!currentPart || currentPart.type === SyntaxKind.newline) {
              break;
            }
            parts.push(currentPart);
            currentIndex++;
          }

          const lastPart = parts[parts.length - 1]!;

          return {
            span: new Span(
              fromIndex,
              parts.length,
              firstPart.span.startLocation,
              lastPart.span.endLocation,
            ),
          };
        }

        return null;
      },
      {
        invisible: true,
      },
    ],
    [
      SyntaxKind.whitespace,
      (
        partSet: PartSet,
        fromIndex: number = 0,
      ): { span: Span; errors?: any[] } | null => {
        const part = partSet.parts[fromIndex];
        if (part?.type !== SyntaxKind.whitespace) return null;
        return {
          span: new Span(
            fromIndex,
            1,
            part.span.startLocation,
            part.span.endLocation,
          ),
        };
      },
      {
        invisible: true,
        transform(token) {
          const isIndent = token.span.startLocation.column === 0;
          if (isIndent) return Token.from(SyntaxKind.indent, token.parts);
          return token;
        },
      },
    ],
    [
      SyntaxKind.openCurlyBrace,
      (
        partSet: PartSet,
        fromIndex: number = 0,
      ): { span: Span; errors?: any[] } | null => {
        const part = partSet.parts[fromIndex];
        if (part?.type !== SyntaxKind.openCurlyBrace) return null;
        return {
          span: new Span(
            fromIndex,
            1,
            part.span.startLocation,
            part.span.endLocation,
          ),
        };
      },
    ],
    [
      SyntaxKind.closeCurlyBrace,
      (
        partSet: PartSet,
        fromIndex: number = 0,
      ): { span: Span; errors?: any[] } | null => {
        const part = partSet.parts[fromIndex];
        if (part?.type !== SyntaxKind.closeCurlyBrace) return null;
        return {
          span: new Span(
            fromIndex,
            1,
            part.span.startLocation,
            part.span.endLocation,
          ),
        };
      },
    ],
    [
      SyntaxKind.newline,
      (
        partSet: PartSet,
        fromIndex: number = 0,
      ): { span: Span; errors?: any[] } | null => {
        const part = partSet.parts[fromIndex];
        if (part?.type !== SyntaxKind.newline) return null;
        return {
          span: new Span(
            fromIndex,
            1,
            part.span.startLocation,
            part.span.endLocation,
          ),
        };
      },
    ],
    [
      SyntaxKind.string,
      (
        partSet: PartSet,
        fromIndex: number = 0,
      ): { span: Span; errors?: any[] } | null => {
        const errors: string[] = [];
        const openPart = partSet.parts[fromIndex];
        if (!openPart) return null;

        const isSingleQuoteOrDobleQuote: boolean =
          openPart.type === SyntaxKind.singleQuote ||
          openPart.type === SyntaxKind.doubleQuote;
        if (!isSingleQuoteOrDobleQuote) return null;

        let closePart: Part | null = null;

        /** Smybol `\` to scape next char. Encode UTF-8. */
        const scapeChar = 0x5c;

        // Each the close part
        // - Solve scape symbol
        for (
          let index = fromIndex + 1,
            currentPart = partSet.parts[index],
            nextPart = partSet.parts[index + 1];
          index < partSet.parts.length && !!currentPart;
          index++,
            currentPart = partSet.parts[index],
            nextPart = partSet.parts[index + 1]
        ) {
          const isEscapeSymbol =
            currentPart.buffer.length === 1 &&
            currentPart.buffer[0] === scapeChar;
          const isClosingQuote = currentPart.type === openPart.type;
          const nextPartIsQuote =
            isEscapeSymbol && nextPart?.type === openPart.type;
          const isNextPartNewline = nextPart?.type === SyntaxKind.newline;

          if (nextPartIsQuote) {
            index++;
            continue;
          }

          if (isNextPartNewline && !isClosingQuote) {
            closePart = currentPart;
            errors.push("Unclosed string");
            break;
          }

          if (isClosingQuote) {
            closePart = currentPart;
            break;
          }
        }

        if (closePart) {
          const spanLength =
            partSet.parts.indexOf(closePart) -
            partSet.parts.indexOf(openPart) +
            1;

          return {
            span: new Span(
              partSet.parts.indexOf(openPart),
              spanLength,
              openPart.span.startLocation,
              closePart.span.endLocation,
            ),
            errors: errors.length ? errors : undefined,
          };
        }

        return null;
      },
    ],
    [
      SyntaxKind.heredoc,
      (
        partSet: PartSet,
        fromIndex: number,
      ): { span: Span; errors?: any[] } | null => {
        // [3C]: <
        // next 3 parts are [3C]
        const isMatchOpenHeredoc = partSet.parts
          .slice(fromIndex, fromIndex + 3)
          .every(
            (part) => part.buffer.length === 1 && part.buffer.at(0)! === 0x3c,
          );
        if (!isMatchOpenHeredoc) return null;

        const openPart = partSet.parts.at(fromIndex) ?? null;
        if (!openPart) return null;

        // find next newline
        const newlineIndex = findIndex(
          partSet.parts,
          (part) => part.type === SyntaxKind.newline,
          fromIndex + 3,
        );
        if (newlineIndex === -1) return null;

        const newlinePart = partSet.parts.at(newlineIndex) ?? null;
        if (!newlinePart) return null;

        // current padding
        const currentPaddingLine =
          partSet.parts.at(fromIndex)?.span.startLocation.paddingLine ?? null;
        if (currentPaddingLine === null) return null;

        const startPadding = openPart.span.startLocation.paddingLine;

        const closeClosePartIndex = findIndex(
          partSet.parts,
          (_part, index, parts) => {
            const part = parts[index + 1];
            if (!part) return true;
            const partPadding = part.span.startLocation.paddingLine;
            const partIsClosed = partPadding <= startPadding;
            return partIsClosed;
          },
          newlineIndex + 1,
        );

        // if closeClosePartIndex === -1 find last part
        const closePart = partSet.parts.at(closeClosePartIndex)!;

        const spanLength =
          partSet.parts.indexOf(closePart) -
          partSet.parts.indexOf(openPart) +
          1;

        return {
          span: new Span(
            partSet.parts.indexOf(openPart),
            spanLength,
            openPart.span.startLocation,
            closePart.span.endLocation,
          ),
        };
      },
    ],
    [
      SyntaxKind.keyword,
      (
        partSet: PartSet,
        fromIndex: number = 0,
      ): { span: Span; errors?: any[] } | null => {
        const skiplist = [SyntaxKind.whitespace, SyntaxKind.newline];

        const parts = [
          ...takeWhile(
            partSet.parts,
            (part) => !skiplist.includes(part.type),
            fromIndex,
          ),
        ];

        if (parts.length === 0) return null;

        return {
          span: new Span(
            fromIndex,
            parts.length,
            parts.at(0)!.span.startLocation,
            parts.at(-1)!.span.endLocation,
          ),
        };
      },
      {
        transform(token) {
          const isInteger =
            // expr: {number}
            partsMatch(token, [{ type: { eq: SyntaxKind.integer } }]) ||
            // expr: {number}.{number}
            partsMatch(token, [
              { type: { eq: SyntaxKind.integer } },
              { type: { eq: SyntaxKind.dot } },
              { type: { eq: SyntaxKind.integer } },
            ]) ||
            // expr: -{number}
            partsMatch(token, [
              { buffer: { eq: [45] } },
              {
                type: { eq: SyntaxKind.integer },
              },
            ]) ||
            // expr: -{number}.{number}
            partsMatch(token, [
              { buffer: { eq: [45] } },
              { type: { eq: SyntaxKind.integer } },
              { type: { eq: SyntaxKind.dot } },
              { type: { eq: SyntaxKind.integer } },
            ]) ||
            // expr: {number}n
            partsMatch(token, [
              { type: { eq: SyntaxKind.integer } },
              { buffer: { eq: [110] } },
            ]);

          const isBoolean =
            partsMatch(token, [
              { buffer: { eq: [116, 114, 117, 101] } }, // true
            ]) ||
            partsMatch(token, [
              { buffer: { eq: [102, 97, 108, 115, 101] } }, // false
            ]);

          const isNull = partsMatch(token, [
            { buffer: { eq: [110, 117, 108, 108] } }, // null
          ]);

          if (isInteger) {
            return Token.from(SyntaxKind.numeric, token.parts);
          }

          if (isBoolean) {
            return Token.from(SyntaxKind.boolean, token.parts);
          }

          if (isNull) {
            return Token.from(SyntaxKind.null, token.parts);
          }

          return token;
        },
      },
    ],
  ];

  static from(type: SyntaxKind, parts: Part[]) {
    const firstPart = parts.at(0)!;
    return new Token(
      type,
      parts,
      new Span(
        firstPart.span.index,
        parts.reduce((len, part) => len + part.span.length, 0),
        firstPart.span.startLocation,
        parts.at(-1)!.span.endLocation,
      ),
    );
  }

  static scan(partSet: PartSet, options?: TokenOptions): Token[] {
    const showInvisibleTokens = options?.showInvisibleTokens ?? false;

    const tokens: Token[] = [];

    const matchToken = (
      fromIndex: number,
    ): {
      token: Token;
      errors: any[] | null;
      options: MatchOptions | null;
    } | null => {
      for (const [kind, matchFn, options] of this.matches) {
        const result = matchFn(partSet, fromIndex);
        const resultMatch = result?.span ?? null;

        if (resultMatch) {
          const parts = partSet.parts.slice(
            resultMatch.index,
            resultMatch.index + resultMatch.length,
          );

          return {
            token: Token.from(kind, parts),
            errors: result?.errors ?? null,
            options: options ?? null,
          };
        }
      }

      // return unknown token
      const paths = partSet.parts.slice(fromIndex, fromIndex + 1);

      if (paths.length === 0) return null;

      return {
        token: Token.from(SyntaxKind.unknown, paths),
        errors: null,
        options: null,
      };
    };

    let pathIndex = 0;

    while (true) {
      const { token, errors, options } = matchToken(pathIndex) ?? {
        token: null,
        errors: null,
        options: null,
      };
      if (!token) break;
      const nextToken = options?.transform ? options.transform(token) : token;
      pathIndex += nextToken.parts.length;
      const invisible = showInvisibleTokens
        ? false
        : (options?.invisible ?? false);
      const pushToken = !invisible;

      if (errors) for (const error of errors) nextToken.describeError(error);

      if (pushToken) {
        tokens.push(nextToken);
      }
    }

    return tokens;
  }

  #errors = new Set<string>();
  describeError(error: any) {
    this.#errors.add(error);
  }

  getErrors() {
    return Array.from(this.#errors);
  }

  arrayBuffer() {
    return new Uint8Array(this.parts.map((part) => part.buffer).flat());
  }

  text() {
    if (this.type === SyntaxKind.string) {
      return new TextDecoder().decode(this.arrayBuffer().slice(1, -1));
    }
    return new TextDecoder().decode(this.arrayBuffer());
  }

  raw() {
    return new TextDecoder().decode(this.arrayBuffer());
  }

  toJS() {
    const parsers: Partial<Record<SyntaxKind, () => any>> = {
      [SyntaxKind.numeric]: () => {
        const text = this.text();
        return text.endsWith("n") ? BigInt(text.slice(0, -1)) : Number(text);
      },
      [SyntaxKind.boolean]: () => this.text() === "true",
      [SyntaxKind.null]: () => null,
    };

    return parsers[this.type]?.() ?? this.text();
  }

  json() {
    return {
      type: this.type,
      text: this.text(),
      span: this.span,
      parts: this.parts,
    };
  }

  toJSON() {
    return this.json();
  }
}
