import { DON, Directive } from "./don.js";
import { ROOT_DIRECTIVE_NAME } from "./root-directive-name.js";
import type { Token } from "./v1/compiler/token.js";

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

export interface LintContext {
  /** The directive the rule matched. */
  directive: Directive;
  /** The matched directive's parent, or `null` at the document root. */
  parent: Directive | null;
  /** Real directive names from the document root down to `directive`. */
  namePath: string[];
}

export interface LintRule {
  /**
   * Dot-separated chain of directive names (e.g. `"server.location"`) this
   * rule is scoped to. `evaluation` runs once for every directive in the
   * document whose own name, preceded by its ancestors' names, ends with
   * this chain. Omit to run `evaluation` once against the document root.
   */
  path?: string;
  evaluation: (context: LintContext) => LintIssue[];
}

export interface LintOptions {
  /**
   * Source name shown in a reported issue's `trace` (e.g. a file path).
   * @default "<input>"
   */
  payload?: string;
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

const traceOfToken = (payload: string, token: Token): string => {
  const { line, column } = token.span.startLocation;
  return `${payload}:${line + 1}:${column + 1}`;
};

interface Match {
  directive: Directive;
  parent: Directive | null;
  namePath: string[];
}

const collectNodes = (root: Directive): Match[] => {
  const matches: Match[] = [];

  const visit = (
    directive: Directive,
    parent: Directive | null,
    namePath: string[],
  ) => {
    const isSyntheticRoot = directive.name === ROOT_DIRECTIVE_NAME;
    const nextNamePath = isSyntheticRoot
      ? namePath
      : [...namePath, String(directive.name)];

    if (!isSyntheticRoot) {
      matches.push({ directive, parent, namePath: nextNamePath });
    }

    for (const child of directive.children) {
      visit(child, isSyntheticRoot ? parent : directive, nextNamePath);
    }
  };

  visit(root, null, []);
  return matches;
};

const matchesPath = (namePath: string[], components: string[]): boolean => {
  if (components.length > namePath.length) return false;
  const offset = namePath.length - components.length;
  return components.every((name, index) => namePath[offset + index] === name);
};

/**
 * Runs a set of `LintRule`s against a DON document and returns every issue
 * their `evaluation`s report, filling in `trace` from `loc.start` when the
 * rule didn't already set one.
 */
export const lint = (
  input: string | Directive,
  rules: LintRule[],
  options: LintOptions = {},
): LintIssue[] => {
  const root = typeof input === "string" ? DON.parse(input) : input;
  const payload = options.payload ?? "<input>";
  const issues: LintIssue[] = [];

  for (const rule of rules) {
    const targets = rule.path
      ? collectNodes(root).filter((match) =>
          matchesPath(match.namePath, rule.path!.split(".")),
        )
      : [{ directive: root, parent: null, namePath: [] as string[] }];

    for (const { directive, parent, namePath } of targets) {
      for (const issue of rule.evaluation({ directive, parent, namePath })) {
        issues.push(
          issue.trace || !issue.loc
            ? issue
            : { ...issue, trace: traceOfToken(payload, issue.loc.start) },
        );
      }
    }
  }

  return issues;
};
