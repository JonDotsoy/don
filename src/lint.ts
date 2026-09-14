/**
 * @deprecated This function-based lint engine is superseded by the
 * declarative, object/JSON-format `LintRuleDocument` engine in
 * `donly/lint/lint` (see `docs/lint/rules.md`). New rules should be
 * written against `lintSchema`/`lint` from `./lint/lint.js` instead; this
 * module is kept only for existing consumers and receives no new features.
 */
import { DON, Directive } from "./don.js";
import { ROOT_DIRECTIVE_NAME } from "./root-directive-name.js";
import type { Token } from "./v1/compiler/token.js";
import type { LintIssue } from "./lint/types.js";

export type { LintSeverity, LintLoc, LintIssue } from "./lint/types.js";
export { directiveLoc, argumentLoc } from "./lint/types.js";

/** @deprecated Use the declarative `LintRuleDocument` engine in `./lint/lint.js` instead. */
export interface LintContext {
  /** The directive the rule matched. */
  directive: Directive;
  /** The matched directive's parent, or `null` at the document root. */
  parent: Directive | null;
  /** Real directive names from the document root down to `directive`. */
  namePath: string[];
}

/**
 * @deprecated Superseded by `LintRuleDocument` (see `docs/lint/rules.md`
 * and `./lint/schema.js`), evaluated with `lintSchema`/`lint` from
 * `./lint/lint.js`.
 */
export interface LintRule {
  /**
   * Absolute, `/`-separated chain of directive names from the document root
   * (e.g. `"/server/location"`) this rule is scoped to. `evaluation` runs
   * once for every directive whose own name, preceded by its ancestors' names
   * up to the document root, matches this chain exactly. Omit to run
   * `evaluation` once against the document root.
   */
  path?: string;
  evaluation: (context: LintContext) => Iterable<LintIssue>;
}

/** @deprecated Options for the deprecated `lint` function in this module. */
export interface LintOptions {
  /**
   * Source name shown in a reported issue's `trace` (e.g. a file path).
   * @default "<input>"
   */
  payload?: string;
}

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

/** Splits an absolute `/server/location` path into `["server", "location"]`. */
const pathComponents = (path: string): string[] =>
  path.split("/").filter((component) => component.length > 0);

const matchesPath = (namePath: string[], components: string[]): boolean =>
  components.length === namePath.length &&
  components.every((name, index) => namePath[index] === name);

/**
 * Runs a set of `LintRule`s against a DON document and returns every issue
 * their `evaluation`s report, filling in `trace` from `loc.start` when the
 * rule didn't already set one.
 *
 * @deprecated Use `lintSchema`/`lint` from `./lint/lint.js` with a
 * declarative `LintRuleDocument` instead (see `docs/lint/rules.md`).
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
          matchesPath(match.namePath, pathComponents(rule.path!)),
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
