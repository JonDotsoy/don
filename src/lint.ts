import { Directive } from "./don.js";
import { ROOT_DIRECTIVE_NAME } from "./root-directive-name.js";

export type LintSeverity = "error" | "warning";

export interface LintIssue {
  /** The rule's path, e.g. `/server/port`. */
  path: string;
  message: string;
  severity: LintSeverity;
  directive: Directive;
}

export interface LintRuleContext {
  path: string;
}

/**
 * A custom lint rule: matches directives by path (e.g. `/server/port`,
 * pointing at any directive named `port` nested under a top-level `server`)
 * and validates each match. Return `false` to report `message`.
 */
export interface LintRule {
  /** Directive path, e.g. `/server/port`. Segments are directive names. */
  path: string;
  message?: string;
  severity?: LintSeverity;
  validate: (directive: Directive, context: LintRuleContext) => boolean | void;
}

const topLevelDirectives = (root: Directive): Directive[] =>
  root.name === ROOT_DIRECTIVE_NAME ? root.children : [root];

/**
 * Resolves a `/`-separated path of directive names against the document
 * root returned by `DON.parse()`, returning every directive matching the
 * last segment (there can be more than one, e.g. repeated directive names).
 */
export const findByPath = (root: Directive, path: string): Directive[] => {
  const segments = path.split("/").filter((segment) => segment.length > 0);

  let candidates: Directive[] = topLevelDirectives(root);
  let matched: Directive[] = [];

  for (const segment of segments) {
    matched = candidates.filter((directive) => directive.name === segment);
    candidates = matched.flatMap((directive) => directive.children);
  }

  return matched;
};

/**
 * Runs a set of `LintRule`s against a parsed DON document, returning every
 * issue found. A rule with no matching directive simply reports nothing.
 */
export const lint = (root: Directive, rules: LintRule[]): LintIssue[] => {
  const issues: LintIssue[] = [];

  for (const rule of rules) {
    const context: LintRuleContext = { path: rule.path };

    for (const directive of findByPath(root, rule.path)) {
      if (rule.validate(directive, context) === false) {
        issues.push({
          path: rule.path,
          message: rule.message ?? `Rule violated at "${rule.path}"`,
          severity: rule.severity ?? "error",
          directive,
        });
      }
    }
  }

  return issues;
};
