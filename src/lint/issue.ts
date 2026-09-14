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
