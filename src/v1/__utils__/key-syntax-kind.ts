import { SyntaxKind } from "../utils/syntax-kind.js";

export const KeySyntaxKind: Record<number | string, string> = {
  [SyntaxKind.unknown]: "Unknown",
  [SyntaxKind.alphabet]: "Alphabet",
  [SyntaxKind.integer]: "Int",
  [SyntaxKind.whitespace]: "Whitespace",
  [SyntaxKind.newline]: "Newline",
  [SyntaxKind.dot]: "Dot",
  [SyntaxKind.underscore]: "underscore",
  [SyntaxKind.openCurlyBrace]: "OpenCurlyBrace",
  [SyntaxKind.closeCurlyBrace]: "CloseCurlyBrace",
  [SyntaxKind.keyword]: "Keyword",
  [SyntaxKind.numeric]: "Numeric",
  [SyntaxKind.boolean]: "Boolean",
  [SyntaxKind.null]: "Null",
  [SyntaxKind.comment]: "Comment",
  [SyntaxKind.indent]: "Indent",
  [SyntaxKind.heredoc]: "Heredoc",
  [SyntaxKind.singleQuote]: "SingleQuote",
  [SyntaxKind.doubleQuote]: "DoubleQuote",
  [SyntaxKind.string]: "String",
};
