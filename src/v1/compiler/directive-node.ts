import { Span } from "./span.js";
import type { Token } from "./token.js";

const cursorIndex = { current: -1 };
const uid = () => ++cursorIndex.current;

export class DocumentNode {
  constructor(
    readonly children: DirectiveNode[],
    readonly span: Span,
  ) {}

  static fromNodes(nodes: DirectiveNode[]) {
    const first = nodes.at(0);
    const last = nodes.at(-1);

    if (!first || !last) {
      const emptyLocation = { paddingLine: 0, line: 0, column: 0 };
      return new DocumentNode([], new Span(0, 0, emptyLocation, emptyLocation));
    }

    return new DocumentNode(
      nodes,
      new Span(
        first.span.index,
        last.span.index + last.span.length,
        first.span.startLocation,
        last.span.endLocation,
      ),
    );
  }
}

export class DirectiveNode {
  #id = uid();

  get id() {
    return this.#id;
  }

  readonly name: Token;
  readonly args: Token[];
  readonly children: DirectiveNode[];
  readonly span: Span;

  constructor(name: Token, args: Token[], children: DirectiveNode[]) {
    this.name = name;
    this.args = args;
    this.children = children;
    const lastToken = this.lastToken();
    this.span = new Span(
      this.name.span.index,
      lastToken.span.index + lastToken.span.length,
      this.name.span.startLocation,
      lastToken.span.endLocation,
    );
  }

  private lastToken(): Token {
    return this.children.at(-1)?.lastToken() ?? this.args.at(-1) ?? this.name;
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name.text(),
      args: this.args.map((arg) => arg.text()),
      span: this.span,
      children: this.children,
    };
  }
}
