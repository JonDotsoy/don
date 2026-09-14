import { Directive } from "../don.js";
import type { Token } from "../v1/compiler/token.js";

export type LintSeverity = "error" | "warning" | "info";

export interface LintLoc {
  readonly start: Token;
  readonly end: Token;
}

export interface LintIssue {
  message: string;
  severity: LintSeverity;
  trace?: string;
  loc?: LintLoc;
}

/**
 * The `{ start, end }` tokens of a directive's own name and args (not its
 * children's), or `undefined` for a directive with no backing tokens (e.g.
 * one built by hand rather than parsed by `DON.parse()`).
 */
export const directiveLoc = (directive: Directive): LintLoc | undefined => {
  const tokens = Directive.tokensByDirective(directive);
  if (!tokens || tokens.length === 0) return undefined;

  return { start: tokens[0]!, end: tokens[tokens.length - 1]! };
};

/**
 * The `loc` of one positional argument (`directive.args[index]`), or of a
 * range of them (`directive.args[startIndex..endIndex]`) when `endIndex` is
 * given. `undefined` for a directive with no backing tokens, or for an
 * out-of-range index.
 */
export const argumentLoc = (
  directive: Directive,
  startIndex: number,
  endIndex: number = startIndex,
): LintLoc | undefined => {
  const tokens = Directive.tokensByDirective(directive);
  const start = tokens?.[startIndex + 1];
  const end = tokens?.[endIndex + 1];
  if (!start || !end) return undefined;

  return { start, end };
};
