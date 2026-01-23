import { DirectiveNode, DocumentNode } from "./v1/compiler/directive-node";
import { SyntaxEncode } from "./v1/compiler/syntax-encode";

export class Directive {
  constructor(
    readonly name: string,
    readonly args: (number | string | boolean)[],
    readonly children: Directive[] = [],
  ) {}
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
    const documentNode = new SyntaxEncode().encode(text);

    return docToDirective(documentNode);
  }
}
