import { Directive, type Loc } from "./don.js";
import { ROOT_DIRECTIVE_NAME } from "./root-directive-name.js";

export type LintSeverity = "error" | "warning";

/** What a `validate`/`validateGroup` callback returns to report a violation. Return nothing (`void`) when the directive is valid. */
export interface LintViolation {
  /** Falls back to the rule's own `message` when omitted. */
  message?: string;
  /** Falls back to the rule's own `severity`, then `"error"`, when omitted. */
  severity?: LintSeverity;
  /** Narrows the reported span to a specific part of the directive (e.g. `argLoc(directive, 0)`); falls back to the whole directive's `loc` when omitted. */
  loc?: Loc;
}

export class LintIssue {
  constructor(
    /** The rule's path, e.g. `/server/port`. Absent for a path-less rule that scanned the whole document. */
    readonly path: string | undefined,
    readonly message: string,
    readonly severity: LintSeverity,
    readonly directive: Directive,
    /** The reported directive's source span, absent for synthetic directives. */
    readonly loc: Loc | undefined,
  ) {}
}

export interface LintRuleContext {
  path: string | undefined;
}

/**
 * A custom lint rule: matches directives by path (e.g. `/server/port`,
 * pointing at any directive named `port` nested under a top-level `server`)
 * and validates the matches. Omit `path` to run the rule against every
 * directive in the document instead of a specific one.
 *
 * Set `validate` to check each matching directive independently, or
 * `validateGroup` to check all directives sharing the same name and parent
 * together (e.g. to cap how many times a directive may appear). A rule may
 * set either or both. Both return `void` for a valid directive, or a
 * `LintViolation` (`{ message?, severity? }`) to report one.
 */
export interface LintRule {
  /** Directive path, e.g. `/server/port`. Segments are directive names. Omit to match every directive in the document. */
  path?: string;
  message?: string;
  severity?: LintSeverity;
  validate?: (
    directive: Directive,
    context: LintRuleContext,
  ) => LintViolation | void;
  /** Checked once per parent, against every sibling matching the last path segment (or, path-less, every group of same-named siblings anywhere). */
  validateGroup?: (
    directives: Directive[],
    context: LintRuleContext,
  ) => LintViolation | void;
}

const topLevelDirectives = (root: Directive): Directive[] =>
  root.name === ROOT_DIRECTIVE_NAME ? root.children : [root];

/** Groups every directive in the document by (parent, name), at every depth. */
const collectAllGroups = (root: Directive): Directive[][] => {
  const groups: Directive[][] = [];

  const groupChildren = (children: Directive[]) => {
    const byName = new Map<string | symbol, Directive[]>();

    for (const child of children) {
      const group = byName.get(child.name) ?? [];
      group.push(child);
      byName.set(child.name, group);
    }

    groups.push(...byName.values());
  };

  const walk = (children: Directive[]) => {
    groupChildren(children);
    for (const child of children) walk(child.children);
  };

  walk(topLevelDirectives(root));

  return groups;
};

/**
 * Resolves a `/`-separated path of directive names against the document
 * root returned by `DON.parse()`, grouping the directives matching the
 * last segment by their parent (so repeated directives under the same
 * parent land in the same group). Omit `path` to group every directive in
 * the document instead, at every depth.
 */
export const findGroupsByPath = (
  root: Directive,
  path?: string,
): Directive[][] => {
  if (path === undefined) return collectAllGroups(root);

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
 * Omit `path` to return every directive in the document instead, at every
 * depth.
 */
export const findByPath = (root: Directive, path?: string): Directive[] =>
  findGroupsByPath(root, path).flat();

const describePath = (path: string | undefined): string =>
  path === undefined ? "" : ` at "${path}"`;

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
        const violation = rule.validateGroup(group, context);
        if (!violation) continue;

        issues.push(
          new LintIssue(
            rule.path,
            violation.message ??
              rule.message ??
              `Rule violated${describePath(rule.path)}`,
            violation.severity ?? rule.severity ?? "error",
            group[0]!,
            violation.loc ?? group[0]!.loc,
          ),
        );
      }
    }

    if (rule.validate) {
      for (const directive of findByPath(root, rule.path)) {
        const violation = rule.validate(directive, context);
        if (!violation) continue;

        issues.push(
          new LintIssue(
            rule.path,
            violation.message ??
              rule.message ??
              `Rule violated${describePath(rule.path)}`,
            violation.severity ?? rule.severity ?? "error",
            directive,
            violation.loc ?? directive.loc,
          ),
        );
      }
    }
  }

  return issues;
};
