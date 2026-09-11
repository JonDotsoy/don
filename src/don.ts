import { DirectiveNode, DocumentNode } from "./v1/compiler/directive-node.js";
import { SyntaxParser } from "./v1/compiler/syntax-encode.js";
import { directiveToJSON, wrapAsRoot } from "./directive-json.js";
import { HeredocValue } from "./v1/compiler/heredoc-value.js";
import {
  findAllDirectives,
  findFirstDirective,
  ResultMatchDirectives,
} from "./directive-query.js";

export { HeredocValue } from "./v1/compiler/heredoc-value.js";

export type DirectiveArg = number | string | boolean | HeredocValue;

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
    readonly args: DirectiveArg[],
    readonly children: Directive[] = [],
  ) {}

  toJSON(): unknown {
    return directiveToJSON(this);
  }

  findAll(path: string): ResultMatchDirectives {
    return findAllDirectives(this, path);
  }

  findFirst(path: string): Directive | undefined {
    return findFirstDirective(this, path);
  }

  map<R>(fn: (args: DirectiveArg[], directive: Directive) => R): R {
    return fn(this.args, this);
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

const docToDirective = (node: DocumentNode): Directive =>
  wrapAsRoot(node.children.map((child) => toDirective(child)));

export class DON {
  static parse(text: string): Directive {
    const documentNode = new SyntaxParser().parse(text);

    return docToDirective(documentNode);
  }
}
