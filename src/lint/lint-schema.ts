/**
 * Runtime evaluator for the object/JSON-format `LintRuleDocument` design
 * described in `docs/lint/rules.md` (types: `./schema.ts`).
 */
import { DON, Directive, HeredocValue } from "../don.js";
import { ROOT_DIRECTIVE_NAME } from "../root-directive-name.js";
import { argumentLoc, directiveLoc, type LintIssue } from "./types.js";
import type {
  ArgumentConstraint,
  ArgumentType,
  LintRuleDocument,
  RuleBody,
} from "./schema.js";

/** Splits an absolute or relative `/a/b` path into `["a", "b"]`. */
const pathComponents = (path: string): string[] =>
  path.split("/").filter((component) => component.length > 0);

/**
 * Parses a document/body key into the sub-path it descends (possibly empty,
 * for a bare `"[N]"` selector or the root selector `"/"`) and the 1-based
 * argument position it selects, if any (bare `"[N]"` or fused `"/name[N]"`).
 */
const parseSelectorKey = (
  key: string,
): { segments: string[]; argIndex?: number } => {
  const fused = key.match(/^(\/.*)\[(\d+)\]$/);
  if (fused) {
    return { segments: pathComponents(fused[1]!), argIndex: Number(fused[2]) };
  }

  const bare = key.match(/^\[(\d+)\]$/);
  if (bare) {
    return { segments: [], argIndex: Number(bare[1]) };
  }

  return { segments: pathComponents(key) };
};

/** Keys on a `RuleBody` that are metadata, not a sub-path/argument selector. */
const BODY_META_KEYS = new Set([
  "required",
  "max",
  "min",
  "message",
  "severity",
  "and",
  "evaluation",
]);

const bodyKeyEntries = (
  body: RuleBody,
): [string, RuleBody | ArgumentConstraint][] =>
  Object.entries(body).filter(([key]) => !BODY_META_KEYS.has(key)) as [
    string,
    RuleBody | ArgumentConstraint,
  ][];

/**
 * A rule-level `and` entry whose only own keys are sub-paths (no
 * `required`/`max`/`min`/`[N]`/`and` of its own) is treated as an absolute
 * document fragment — evaluated from the document root, independently of
 * whatever path the enclosing key already matched — rather than as an
 * extension of the current match set. See "`and` at the rule level" in the
 * docs: this is what lets its entries address unrelated paths.
 */
const isSubPathOnlyEntry = (entry: RuleBody): boolean => {
  const keys = Object.keys(entry);
  return keys.length > 0 && keys.every((key) => key.startsWith("/"));
};

const matchesType = (value: unknown, type: ArgumentType): boolean => {
  switch (type) {
    case "string":
      return typeof value === "string";
    case "number":
      return typeof value === "number";
    case "bigint":
      return typeof value === "bigint";
    case "boolean":
      return typeof value === "boolean";
    case "null":
      // DON currently decodes the `null` literal to the string "null"
      // rather than JS `null` (see `docs/specs/v1/spec.md`'s own Mixed
      // Types example) — accept either so `type: "null"` is actually
      // useful against real parses.
      return value === null || value === "null";
    case "heredoc":
      return value instanceof HeredocValue;
  }
};

/** The string a `pattern` matches against: the value itself, or a heredoc's `content`. */
const patternSubject = (value: unknown): string | undefined => {
  if (typeof value === "string") return value;
  if (value instanceof HeredocValue) return value.content;
  return undefined;
};

const isNumeric = (value: unknown): value is number | bigint =>
  typeof value === "number" || typeof value === "bigint";

const matchesConstraint = (
  value: unknown,
  constraint: ArgumentConstraint,
): boolean => {
  if (constraint.or)
    return constraint.or.some((c) => matchesConstraint(value, c));
  if (constraint.and)
    return constraint.and.every((c) => matchesConstraint(value, c));
  if (constraint.not) return !matchesConstraint(value, constraint.not);

  if (constraint.type !== undefined && !matchesType(value, constraint.type)) {
    return false;
  }

  if (
    constraint.enum &&
    !constraint.enum.some((literal) => literal === value)
  ) {
    return false;
  }

  if ("pattern" in constraint && constraint.pattern !== undefined) {
    const subject = patternSubject(value);
    if (subject === undefined) return false;
    if (!new RegExp(constraint.pattern, constraint.flags).test(subject)) {
      return false;
    }
  }

  if ("gte" in constraint && constraint.gte !== undefined) {
    if (!isNumeric(value) || !((value as never) >= (constraint.gte as never))) {
      return false;
    }
  }
  if ("gt" in constraint && constraint.gt !== undefined) {
    if (!isNumeric(value) || !((value as never) > (constraint.gt as never))) {
      return false;
    }
  }
  if ("lte" in constraint && constraint.lte !== undefined) {
    if (!isNumeric(value) || !((value as never) <= (constraint.lte as never))) {
      return false;
    }
  }
  if ("lt" in constraint && constraint.lt !== undefined) {
    if (!isNumeric(value) || !((value as never) < (constraint.lt as never))) {
      return false;
    }
  }

  return true;
};

const defaultConstraintMessage = (
  argIndex: number,
  constraint: ArgumentConstraint,
): string =>
  constraint.type
    ? `argument at position ${argIndex} must be of type ${constraint.type}`
    : `argument at position ${argIndex} does not satisfy the constraint`;

const evaluateArgumentConstraint = (
  directive: Directive,
  argIndex: number,
  constraint: ArgumentConstraint,
  issues: LintIssue[],
): void => {
  const value = directive.args[argIndex - 1];
  if (!matchesConstraint(value, constraint)) {
    issues.push({
      message:
        constraint.message ?? defaultConstraintMessage(argIndex, constraint),
      severity: constraint.severity ?? "error",
      loc: argumentLoc(directive, argIndex - 1),
    });
  }

  if (constraint.evaluation) {
    for (const issue of constraint.evaluation(value, argIndex, directive)) {
      issues.push(
        issue.loc
          ? issue
          : { ...issue, loc: argumentLoc(directive, argIndex - 1) },
      );
    }
  }
};

const checkOccurrence = (
  parent: Directive,
  matches: Directive[],
  body: RuleBody,
  issues: LintIssue[],
): void => {
  if (typeof body.max === "number" && matches.length > body.max) {
    for (const extra of matches.slice(body.max)) {
      issues.push({
        message: body.message ?? `too many occurrences (max ${body.max})`,
        severity: body.severity ?? "error",
        loc: directiveLoc(extra),
      });
    }
  }

  if (typeof body.min === "number" && matches.length < body.min) {
    issues.push({
      message: body.message ?? `too few occurrences (min ${body.min})`,
      severity: body.severity ?? "error",
      loc: directiveLoc(parent),
    });
  }
};

const applyValue = (
  matches: Directive[],
  argIndex: number | undefined,
  value: RuleBody | ArgumentConstraint,
  issues: LintIssue[],
  root: Directive,
  /**
   * The directive(s) whose children were searched for `matches` — used only
   * as a loc fallback for `required`, since an unmatched path has no
   * directive of its own to point at.
   */
  contextParents: Directive[] = [],
): void => {
  if (argIndex !== undefined) {
    const constraint = value as ArgumentConstraint;
    for (const directive of matches) {
      evaluateArgumentConstraint(directive, argIndex, constraint, issues);
    }
    return;
  }

  const body = value as RuleBody;

  if (body.required && matches.length === 0) {
    issues.push({
      message: body.message ?? "required directive is missing",
      severity: body.severity ?? "error",
      loc: contextParents[0] ? directiveLoc(contextParents[0]) : undefined,
    });
  }

  if (body.and) {
    for (const entry of body.and) {
      if (isSubPathOnlyEntry(entry)) {
        evaluateDocumentKeys(root, entry as LintRuleDocument, issues);
      } else {
        applyValue(matches, undefined, entry, issues, root, contextParents);
      }
    }
  }

  if (body.evaluation) {
    for (const directive of matches) {
      for (const issue of body.evaluation(directive)) {
        issues.push(
          issue.loc ? issue : { ...issue, loc: directiveLoc(directive) },
        );
      }
    }
  }

  for (const directive of matches) {
    for (const [key, subValue] of bodyKeyEntries(body)) {
      const { segments, argIndex: subArgIndex } = parseSelectorKey(key);
      matchAndEvaluate(
        [directive],
        segments,
        subArgIndex,
        subValue,
        issues,
        root,
      );
    }
  }
};

const matchAndEvaluate = (
  parents: Directive[],
  segments: string[],
  argIndex: number | undefined,
  value: RuleBody | ArgumentConstraint,
  issues: LintIssue[],
  root: Directive,
): void => {
  if (segments.length === 0) {
    applyValue(parents, argIndex, value, issues, root);
    return;
  }

  const [segment, ...rest] = segments as [string, ...string[]];
  const isFinal = rest.length === 0;
  const nextParents: Directive[] = [];

  for (const parent of parents) {
    const matchingChildren = parent.children.filter(
      (child) => segment === "*" || child.name === segment,
    );
    if (isFinal && argIndex === undefined) {
      checkOccurrence(parent, matchingChildren, value as RuleBody, issues);
    }
    nextParents.push(...matchingChildren);
  }

  if (isFinal) {
    applyValue(nextParents, argIndex, value, issues, root, parents);
  } else {
    matchAndEvaluate(nextParents, rest, argIndex, value, issues, root);
  }
};

const evaluateDocumentKeys = (
  root: Directive,
  doc: LintRuleDocument,
  issues: LintIssue[],
): void => {
  for (const [key, value] of Object.entries(doc)) {
    if (
      key === "or" ||
      key === "and" ||
      key === "not" ||
      key === "evaluation"
    ) {
      continue;
    }
    const { segments, argIndex } = parseSelectorKey(key);
    matchAndEvaluate(
      [root],
      segments,
      argIndex,
      value as RuleBody | ArgumentConstraint,
      issues,
      root,
    );
  }
};

const evaluateDocument = (
  root: Directive,
  doc: LintRuleDocument,
): LintIssue[] => {
  if (doc.or) {
    const alternatives = doc.or.map((alt) => evaluateDocument(root, alt));
    const passing = alternatives.find((issues) => issues.length === 0);
    if (passing) return [];
    const best = alternatives.reduce(
      (best, issues) => (issues.length < best.length ? issues : best),
      alternatives[0] ?? [],
    );
    if (doc.message) {
      return [
        {
          message: doc.message,
          severity: doc.severity ?? "error",
          loc: best[0]?.loc ?? directiveLoc(root),
        },
      ];
    }
    return best;
  }

  const issues: LintIssue[] = [];

  if (doc.and) {
    for (const entry of doc.and) issues.push(...evaluateDocument(root, entry));
  }

  if (doc.not) {
    const inner = evaluateDocument(root, doc.not);
    if (inner.length === 0) {
      issues.push({
        message: "document must not match the given rule",
        severity: "error",
      });
    }
  }

  if (doc.evaluation) {
    for (const issue of doc.evaluation(root)) {
      issues.push(issue.loc ? issue : { ...issue, loc: directiveLoc(root) });
    }
  }

  evaluateDocumentKeys(root, doc, issues);

  return issues;
};

/**
 * Lints a DON document against an object/JSON-format `LintRuleDocument`
 * (see `docs/lint/rules.md`), returning every issue its rules
 * report.
 */
export const lintSchema = (
  don: string,
  rule: LintRuleDocument,
): LintIssue[] => {
  const parsed = DON.parse(don);
  // A document with exactly one top-level directive parses to that
  // directive itself rather than a synthetic root (see `wrapAsRoot` in
  // `directive-json.ts`) — normalize so path matching always has a root
  // whose `children` are the document's top-level directives.
  const root =
    parsed.name === ROOT_DIRECTIVE_NAME
      ? parsed
      : new Directive(ROOT_DIRECTIVE_NAME, [], [parsed]);

  return evaluateDocument(root, rule);
};
