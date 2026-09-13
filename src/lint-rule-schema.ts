/**
 * Type definitions for the object/JSON-format `LintRule` design described in
 * `docs/specs/v1/lint-rule.md`. This module is types only — there is no
 * runtime behavior here, only the shapes a lint rule document may take.
 */

/** Mirrors `LintIssue["severity"]` in `./lint.ts`. */
export type RuleSeverity = "error" | "warning" | "info";

/** Every argument kind DON v1 produces (see `docs/specs/v1/spec.md`). */
export type ArgumentType =
  | "string"
  | "number"
  | "bigint"
  | "boolean"
  | "null"
  | "heredoc";

/** A literal value an argument's `enum` constraint may compare against. */
export type ArgumentLiteral = string | number | boolean | null;

/** A single, self-contained validation for one directive argument. */
export interface ArgumentConstraint {
  type?: ArgumentType;
  enum?: readonly ArgumentLiteral[];
  pattern?: string;
  flags?: string;
  gte?: number | bigint;
  gt?: number | bigint;
  lte?: number | bigint;
  lt?: number | bigint;
  or?: readonly ArgumentConstraint[];
  and?: readonly ArgumentConstraint[];
  not?: ArgumentConstraint;
  message?: string;
  severity?: RuleSeverity;
}

/** Key selecting one argument by its 1-based position, e.g. `"[1]"`. */
export type ArgumentSelector = `[${number}]`;

/** Key selecting a child directive by a path relative to its parent, e.g. `"/route"`. */
export type SubPathSelector = `/${string}`;

/**
 * The body of a rule: everything a document key (or an explicit `path`
 * field, see `LintRule`) can carry, minus the path itself.
 */
export interface RuleBody {
  /** Requires the rule's own path to match at least one directive in the document. */
  required?: boolean;
  /** Caps how many times the sub-path this body belongs to occurs under its parent. */
  max?: number;
  /** Requires at least this many occurrences of the sub-path this body belongs to. */
  min?: number;
  message?: string;
  severity?: RuleSeverity;
  /** Combines full, independently-addressed rules — see "`and` at the rule level". */
  and?: readonly RuleAndEntry[];
  /** `"[N]"` keys: constraints on the argument at that 1-based position. */
  readonly [argument: ArgumentSelector]: ArgumentConstraint;
  /** `"/name"` keys: a nested rule body for that child directive. */
  readonly [subPath: SubPathSelector]: RuleBody;
}

/**
 * A full rule: a `RuleBody` optionally addressed by its own `path`. `path`
 * is omitted when the rule is keyed by its path in a `LintRuleDocument`, or
 * when it's a rule-level `and` entry that defaults to its enclosing key's
 * path — see "`and` at the rule level" in the docs.
 */
export interface LintRule extends RuleBody {
  /**
   * @deprecated Prefer keying the rule by its path in a `LintRuleDocument`
   * (or, inside a rule-level `and`, omitting it to inherit the enclosing
   * key's path). Kept only for the "equivalent shape" array-of-rules form.
   */
  path?: string;
}

/** One entry of a rule-level `and`; `path` defaults to the enclosing key's path when omitted. */
export type RuleAndEntry = LintRule;

/**
 * A rule document: each key is a directive path (optionally fused with an
 * argument selector, e.g. `"/server/route[2]"`), and each value is either a
 * full rule body or, for a fused `path[N]` key, a bare argument constraint.
 */
export type LintRuleDocument = Record<
  SubPathSelector,
  RuleBody | ArgumentConstraint
>;

/** The equivalent shape: an array of rules with an explicit `path` field. */
export type LintRuleArray = readonly LintRule[];
