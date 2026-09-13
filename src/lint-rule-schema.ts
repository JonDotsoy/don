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

/** Fields every constraint shares, regardless of `type`. */
export interface BaseArgumentConstraint {
  enum?: readonly ArgumentLiteral[];
  or?: readonly ArgumentConstraint[];
  and?: readonly ArgumentConstraint[];
  not?: ArgumentConstraint;
  message?: string;
  severity?: RuleSeverity;
}

/** A constraint on a `"string"` argument. */
export interface StringArgumentConstraint extends BaseArgumentConstraint {
  type: "string";
  pattern?: string;
  flags?: string;
}

/** A constraint on a `"number"` argument. */
export interface NumberArgumentConstraint extends BaseArgumentConstraint {
  type: "number";
  gte?: number;
  gt?: number;
  lte?: number;
  lt?: number;
}

/** A constraint on a `"bigint"` argument. */
export interface BigintArgumentConstraint extends BaseArgumentConstraint {
  type: "bigint";
  gte?: bigint;
  gt?: bigint;
  lte?: bigint;
  lt?: bigint;
}

/** A constraint on a `"boolean"` argument; no further refinement beyond `type`. */
export interface BooleanArgumentConstraint extends BaseArgumentConstraint {
  type: "boolean";
}

/** A constraint on a `"null"` argument; no further refinement beyond `type`. */
export interface NullArgumentConstraint extends BaseArgumentConstraint {
  type: "null";
}

/** A constraint on a `"heredoc"` argument; `pattern`/`flags` apply to its `content`. */
export interface HeredocArgumentConstraint extends BaseArgumentConstraint {
  type: "heredoc";
  pattern?: string;
  flags?: string;
}

/** A constraint that doesn't narrow by `type` at all — just `enum`/`or`/`and`/`not`/etc. */
export interface UntypedArgumentConstraint extends BaseArgumentConstraint {
  type?: undefined;
}

/** A single, self-contained validation for one directive argument. */
export type ArgumentConstraint =
  | StringArgumentConstraint
  | NumberArgumentConstraint
  | BigintArgumentConstraint
  | BooleanArgumentConstraint
  | NullArgumentConstraint
  | HeredocArgumentConstraint
  | UntypedArgumentConstraint;

/** Key selecting a child directive by a path relative to its parent, e.g. `"/route"`. */
export type SubPathSelector = `/${string}`;

/**
 * Key selecting one argument by its 1-based position: either bare, e.g.
 * `"[1]"` (of the enclosing body's own path), or fused with a sub-path,
 * e.g. `"/route[2]"` (of that sub-path directly, without an intermediate
 * body) — see "Shorthand: `path[N]` as a single key" in the docs.
 */
export type ArgumentSelector = `[${number}]` | `${SubPathSelector}[${number}]`;

/**
 * The body of a rule: everything a document key (or a nested sub-path key,
 * or a rule-level `and` entry) can carry, minus the path itself — a rule is
 * always addressed by a key, never by a `path` field.
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
  /** `"[N]"`/`"/name[N]"` keys: constraints on the argument at that 1-based position. */
  readonly [argument: ArgumentSelector]: ArgumentConstraint;
  /** `"/name"` keys: a nested rule body for that child directive. */
  readonly [subPath: SubPathSelector]: RuleBody | ArgumentConstraint;
}

/**
 * One entry of a rule-level `and`: a `RuleBody`, addressed either by its
 * own sub-path key(s) or, absent one, applying directly to its enclosing
 * key's path — see "`and` at the rule level" in the docs.
 */
export type RuleAndEntry = RuleBody;

/**
 * A rule document: each key is a directive path (optionally fused with an
 * argument selector, e.g. `"/server/route[2]"`), and each value is either a
 * full rule body or, for a fused `path[N]` key, a bare argument constraint.
 */
export type LintRuleDocument = Record<
  SubPathSelector,
  RuleBody | ArgumentConstraint
>;

/**
 * The equivalent shape: an array of one-entry documents, each keyed by its
 * own path — e.g. `[{ "/server/port": { required: true } }]`.
 */
export type LintRuleArray = readonly LintRuleDocument[];
