import { Directive, type Loc } from "./don.js";
import { ROOT_DIRECTIVE_NAME } from "./root-directive-name.js";

export type LintSeverity = "error" | "warning";

export interface LintIssue {
  /** The rule's path, e.g. `/server/port`. */
  path: string;
  message: string;
  severity: LintSeverity;
  directive: Directive;
  /** The reported directive's source span, absent for synthetic directives. */
  loc: Loc | undefined;
}

export interface LintRuleContext {
  path: string;
}

/**
 * A custom lint rule: matches directives by path (e.g. `/server/port`,
 * pointing at any directive named `port` nested under a top-level `server`)
 * and validates the matches. Return `false` to report `message`.
 *
 * Set `validate` to check each matching directive independently, or
 * `validateGroup` to check all directives sharing the same name and parent
 * together (e.g. to cap how many times a directive may appear). A rule may
 * set either or both.
 */
export interface LintRule {
  /** Directive path, e.g. `/server/port`. Segments are directive names. */
  path: string;
  message?: string;
  severity?: LintSeverity;
  validate?: (directive: Directive, context: LintRuleContext) => boolean | void;
  /** Checked once per parent, against every sibling matching the last path segment. */
  validateGroup?: (
    directives: Directive[],
    context: LintRuleContext,
  ) => boolean | void;
}

const topLevelDirectives = (root: Directive): Directive[] =>
  root.name === ROOT_DIRECTIVE_NAME ? root.children : [root];

/**
 * Resolves a `/`-separated path of directive names against the document
 * root returned by `DON.parse()`, grouping the directives matching the
 * last segment by their parent (so repeated directives under the same
 * parent land in the same group).
 */
export const findGroupsByPath = (
  root: Directive,
  path: string,
): Directive[][] => {
  const segments = path.split("/").filter((segment) => segment.length > 0);

  if (segments.length === 0) return [];

  let frontier: { parent: Directive; directive: Directive }[] =
    topLevelDirectives(root).map((directive) => ({ parent: root, directive }));

  for (let i = 0; i < segments.length; i++) {
    const matched = frontier.filter(
      ({ directive }) => directive.name === segments[i],
    );

    if (i === segments.length - 1) {
      const groups = new Map<Directive, Directive[]>();

      for (const { parent, directive } of matched) {
        const group = groups.get(parent) ?? [];
        group.push(directive);
        groups.set(parent, group);
      }

      return Array.from(groups.values());
    }

    frontier = matched.flatMap(({ directive }) =>
      directive.children.map((child) => ({
        parent: directive,
        directive: child,
      })),
    );
  }

  return [];
};

/**
 * Resolves a `/`-separated path of directive names against the document
 * root returned by `DON.parse()`, returning every directive matching the
 * last segment (there can be more than one, e.g. repeated directive names).
 */
export const findByPath = (root: Directive, path: string): Directive[] =>
  findGroupsByPath(root, path).flat();

/**
 * Runs a set of `LintRule`s against a parsed DON document, returning every
 * issue found. A rule with no matching directive simply reports nothing.
 */
export const lint = (root: Directive, rules: LintRule[]): LintIssue[] => {
  const issues: LintIssue[] = [];

  for (const rule of rules) {
    const context: LintRuleContext = { path: rule.path };

    if (rule.validateGroup) {
      for (const group of findGroupsByPath(root, rule.path)) {
        if (rule.validateGroup(group, context) === false) {
          issues.push({
            path: rule.path,
            message: rule.message ?? `Rule violated at "${rule.path}"`,
            severity: rule.severity ?? "error",
            directive: group[0]!,
            loc: group[0]!.loc,
          });
        }
      }
    }

    if (rule.validate) {
      for (const directive of findByPath(root, rule.path)) {
        if (rule.validate(directive, context) === false) {
          issues.push({
            path: rule.path,
            message: rule.message ?? `Rule violated at "${rule.path}"`,
            severity: rule.severity ?? "error",
            directive,
            loc: directive.loc,
          });
        }
      }
    }
  }

  return issues;
};
