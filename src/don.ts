import { DirectiveNode, DocumentNode } from "./v1/compiler/directive-node.js";
import { SyntaxParser } from "./v1/compiler/syntax-encode.js";
import { directiveToJSON } from "./directive-json.js";
import { HeredocValue } from "./v1/compiler/heredoc-value.js";

export { HeredocValue } from "./v1/compiler/heredoc-value.js";

const inspectSymbol = Symbol.for("nodejs.util.inspect.custom");

// A plain data-only view used only for inspection: returning an
// instance of it from `[inspectSymbol]` (instead of a pre-formatted
// string) lets the engine's own inspector recurse into it — and
// therefore indent nested Directives correctly — while showing only
// name/args/children. It's declared as its own "Directive" class (in
// this closure, distinct from the exported one below) purely so
// util.inspect/Bun.inspect tags the output "Directive { ... }".
const DirectiveInspectView = (() => {
  class Directive {
    constructor(
      readonly name: unknown,
      readonly args: unknown,
      readonly children: unknown,
    ) {}
  }
  return Directive;
})();

export class Directive {
  constructor(
    readonly name: string | symbol,
    readonly args: (number | string | boolean | HeredocValue)[],
    readonly children: Directive[] = [],
  ) {}

  toJSON(): unknown {
    return directiveToJSON(this);
  }

  /**
   * Some runtimes (e.g. `Bun.inspect` under `bun -e`) print `toJSON` as
   * an own enumerable property instead of hiding it like a regular
   * class method. Returning a `DirectiveInspectView` here hides it
   * without losing the engine's own (correctly indented) recursive
   * formatting of nested Directives.
   */
  [inspectSymbol]() {
    return new DirectiveInspectView(this.name, this.args, this.children);
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
