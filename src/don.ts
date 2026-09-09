import { DirectiveNode, DocumentNode } from "./v1/compiler/directive-node.js";
import { SyntaxParser } from "./v1/compiler/syntax-encode.js";
import { directiveToJSON } from "./directive-json.js";

export class Directive {
  constructor(
    readonly name: string | symbol,
    readonly args: (number | string | boolean)[],
    readonly children: Directive[] = [],
  ) {}

  toJSON(): unknown {
    return directiveToJSON(this);
  }
}

const toDirective = (node: DirectiveNode): Directive => {
  return new Directive(
    node.name.text(),
    node.args.map((token) => token.toJS()),
    node.children.map((child) => toDirective(child)).flat(),
  );
};

const docToDirective = (node: DocumentNode): Directive[] => {
  const directives = node.children.map((node) => {
    return new Directive(
      node.name.text(),
      node.args.map((token) => token.toJS()),
      node.children.map((child) => toDirective(child)).flat(),
    );
  });

  return directives;
};

export class DON {
  static parse(text: string) {
    const documentNode = new SyntaxParser().parse(text);

    return docToDirective(documentNode);
  }
}
