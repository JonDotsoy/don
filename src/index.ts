import { LexerParser } from "./v1/compiler/lexema-encode.js";
import { SyntaxKind } from "./v1/utils/syntax-kind.js";

export { SyntaxParser as SyntaxEncode } from "./v1/compiler/syntax-encode.js";
export { LexerParser } from "./v1/compiler/lexema-encode.js";
export type { Token } from "./v1/compiler/token.js";
export { DON, Directive, HeredocValue } from "./don.js";
export type { Loc } from "./don.js";
export {
  DirectiveJSONEncoder,
  DirectiveJSONDecoder,
  ROOT_DIRECTIVE_NAME,
} from "./directive-json.js";
export type {
  DirectiveReducer,
  DirectiveJSONEncoderOptions,
} from "./directive-json.js";
export { lint, findByPath, findGroupsByPath } from "./lint.js";
export type {
  LintRule,
  LintIssue,
  LintSeverity,
  LintRuleContext,
} from "./lint.js";

const typeStrings: Partial<Record<SyntaxKind, string>> = {
  [SyntaxKind.keyword]: "keyword",
  [SyntaxKind.string]: "string",
  [SyntaxKind.numeric]: "numeric",
  [SyntaxKind.boolean]: "boolean",
  [SyntaxKind.null]: "null",
  [SyntaxKind.heredoc]: "heredoc",
  [SyntaxKind.comment]: "comment",
  [SyntaxKind.openCurlyBrace]: "openCurlyBrace",
  [SyntaxKind.closeCurlyBrace]: "closeCurlyBrace",
};

export const donToParts = (text: string) =>
  Array.from(new LexerParser({ debug: true }).parse(text).tokens, (token) => ({
    _syntax_type: token.type,
    type: typeStrings[token.type] ?? `literal`,
    value: token.raw(),
  }));
