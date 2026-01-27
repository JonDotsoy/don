import { buildLogger } from "../utils/build-logger.js";
import { SyntaxKind } from "../utils/syntax-kind.js";
import { DirectiveNode, DocumentNode } from "./directive-node.js";
import { LexemaEncode } from "./lexema-encode.js";
import { Lexema } from "./lexema.js";
import type { PartSet } from "./part-set.js";
import { Token } from "./token.js";

const isTextCallable = (value: unknown): value is { text(): unknown } =>
  typeof value === "object" &&
  value !== null &&
  "text" in value &&
  typeof value.text === "function";

const log2 = (...args: Parameters<typeof String.raw>) => {
  const [template, ...substitutions] = args;
  console.log(
    String.raw(
      template,
      ...substitutions.map((substitution) => {
        if (substitution === null) return `null`;
        if (isTextCallable(substitution)) return substitution.text();
        if (
          typeof substitution === "object" &&
          substitution !== null &&
          Array.isArray(substitution)
        ) {
          return substitution.map((item) => {
            if (isTextCallable(item)) return item.text();
            return item;
          });
        }
        return substitutions;
      }),
    ),
  );
};

const log = buildLogger({
  enabled: process.env.NODE_ENV === "test",
  tranformSubstitutions: [
    { test: (value) => value === null, transform: () => "null" },
    { test: (value) => value === undefined, transform: () => "undefined" },
    {
      test: (value) => isTextCallable(value),
      transform: (value) => value.text(),
    },
  ],
});

class State<T> {
  constructor(public current: T) {}
}

const tokenParse = (token: Token) => {
  switch (token.type) {
    case SyntaxKind.keyword:
      return token.text();
    case SyntaxKind.string:
      return token.text();
    case SyntaxKind.null:
      return null;
    case SyntaxKind.numeric:
      const text = token.text();
      if (text.endsWith("n")) return BigInt(text.slice(0, -1));
      return Number(token.text());
    case SyntaxKind.boolean:
      return token.text() === "true";
  }
  return token.text();
};

class SpanDirectiveResult {
  constructor(
    readonly startToken: Token,
    readonly endToken: Token,
    readonly directives: DirectiveNode[],
  ) {}
}

export class SyntaxEncode {
  static raw = new WeakMap<
    DocumentNode,
    string | Uint8Array | Iterable<number> | PartSet | Lexema
  >();

  encode(input: string | Uint8Array | Iterable<number> | PartSet | Lexema) {
    const lexema: Lexema =
      input instanceof Lexema ? input : new LexemaEncode().encode(input);

    const doc = SyntaxEncode.scan(lexema);

    SyntaxEncode.raw.set(doc, input);

    return doc;
  }

  private static scan(lexema: Lexema) {
    const scanDirectiveIdCursor = { current: -1 };

    function scanDirective(
      tokens: Token[],
      fromIndex: number,
      depth: number,
    ): SpanDirectiveResult {
      const id = ++scanDirectiveIdCursor.current;
      const nameTokenState = new State<Token | null>(null);
      const argsTokensState = new State<Token[]>([]);
      const children = new State<DirectiveNode[]>([]);
      const startToken = new State<Token | null>(null);
      const endToken = new State<Token | null>(null);
      const partialDirective = new State<{
        name: null | Token;
        args: Token[];
        children: DirectiveNode[];
      }>({
        name: null,
        args: [],
        children: [],
      });
      const directives = new State<DirectiveNode[]>([]);

      for (let i = fromIndex; i < tokens.length; i++) {
        const token = tokens[i];
        if (!token) break;

        // avoid whitespaces
        if (token.type === SyntaxKind.whitespace) continue;

        if (startToken.current === null && token.type === SyntaxKind.newline)
          continue;

        startToken.current ??= token;
        endToken.current = token;

        if (token.type === SyntaxKind.openCurlyBrace) {
          const result = scanDirective(tokens, i + 1, depth + 1);
          i = tokens.indexOf(result.endToken);
          partialDirective.current.children = result.directives;
          continue;
        }

        if (token.type === SyntaxKind.closeCurlyBrace) {
          break;
        }

        if (
          partialDirective.current.name === null &&
          [
            SyntaxKind.keyword,
            SyntaxKind.string,
            SyntaxKind.numeric,
            SyntaxKind.boolean,
            SyntaxKind.null,
          ].includes(token.type)
        ) {
          partialDirective.current.name = token;
          continue;
        }

        if (
          partialDirective.current.name !== null &&
          [
            SyntaxKind.keyword,
            SyntaxKind.string,
            SyntaxKind.numeric,
            SyntaxKind.boolean,
            SyntaxKind.null,
          ].includes(token.type)
        ) {
          partialDirective.current.args.push(token);
          continue;
        }

        if (
          token.type === SyntaxKind.newline &&
          partialDirective.current.name
        ) {
          // log`endline >>> push token token: ${partialDirective.current.name} args: ${partialDirective.current.args}`;

          directives.current.push(
            new DirectiveNode(
              partialDirective.current.name,
              partialDirective.current.args,
              partialDirective.current.children,
            ),
          );
          partialDirective.current = {
            name: null,
            args: [],
            children: [],
          };
          continue;
        }

        // throw new Error(`unexpected token: ${token.type} ${token.text()}`)
      }

      if (partialDirective.current.name !== null) {
        directives.current.push(
          new DirectiveNode(
            partialDirective.current.name!,
            partialDirective.current.args,
            partialDirective.current.children,
          ),
        );
      }

      // log`partialDirective: ${partialDirective.current.name?.text()} args: ${partialDirective.current.args.map(e => e.text()).join(', ')}`

      return new SpanDirectiveResult(
        startToken.current!,
        endToken.current!,
        directives.current,
      );
    }

    return DocumentNode.fromNodes(
      scanDirective(lexema.tokens, 0, 0).directives,
    );
  }
}
