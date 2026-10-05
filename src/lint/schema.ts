/**
 * Type definitions for the object/JSON-format `LintRule` design described in
 * `docs/lint/rules.md`. This module is types only — there is no
 * runtime behavior here, only the shapes a lint rule document may take.
 */
import type { Directive } from "../don.js";
import type { LintIssue } from "./types.js";

/** Mirrors `LintIssue["severity"]` in `./lint.ts`. */
export type RuleSeverity = "error" | "warning" | "info";

/** Every argument kind DON v1 produces (see `docs/specs/v1/spec.md`). */
export type ArgumentType =
  | "string"
  | "number"
  | "bigint"
  | "boolean"
  | "null"
  | "heredoc"
  | "duration"
  | "plain-date"
  | "PlainDate"
  | "plain-time"
  | "PlainTime"
  | "plain-date-time"
  | "PlainDateTime"
  | "instant"
  | "Instant"
  | "plain-year-month"
  | "PlainYearMonth"
  | "plain-month-day"
  | "PlainMonthDay"
  | "zoned-date-time"
  | "ZonedDateTime"
  | "epoch-seconds"
  | "EpochSeconds"
  | "unix"
  | "epoch-milliseconds"
  | "EpochMilliseconds"
  | "epoch-nanoseconds"
  | "EpochNanoseconds";

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
  /**
   * Escape hatch: arbitrary custom logic for this argument, e.g.
   * `{ "/path[1]": { evaluation: (argument, position, directive) => [...] } }`.
   * `position` is the argument's 1-based position (matching the `[N]`
   * selector that reached it). Runs in addition to (not instead of)
   * `type`/`enum`/`pattern`/etc. on the same constraint, and to
   * `and`/`or`/`not` alternatives.
   */
  evaluation?: (
    argument: unknown,
    position: number,
    directive: Directive,
  ) => Iterable<LintIssue>;
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

/**
 * Constraints inspired by the Temporal API. They are string-based and are
 * checked by parsing the argument with `temporal-polyfill`'s
 * `Temporal.<Type>.from(value)`.
 *
 * - `"duration"`: an ISO 8601 duration accepted by `Temporal.Duration.from()`
 *   (e.g. `"P1Y2M3DT4H5M6.5S"`, `"PT30M"`, `"-P1W"`).
 * - `"plain-date"` / `"PlainDate"`: `YYYY-MM-DD`, like `Temporal.PlainDate`.
 * - `"plain-time"` / `"PlainTime"`: `HH:mm[:ss[.fffffffff]]`, like
 *   `Temporal.PlainTime`.
 * - `"plain-date-time"` / `"PlainDateTime"`: `YYYY-MM-DDTHH:mm[:ss[.f]]` with
 *   no `Z` or offset, like `Temporal.PlainDateTime`.
 * - `"instant"` / `"Instant"`: a date-time with a required `Z` or numeric
 *   offset, like `Temporal.Instant` (`2024-02-29T10:30:00Z`).
 * - `"plain-year-month"` / `"PlainYearMonth"`: `YYYY-MM`.
 * - `"plain-month-day"` / `"PlainMonthDay"`: `MM-DD` or `--MM-DD` (`02-29` is
 *   valid, `02-30` is not).
 * - `"zoned-date-time"` / `"ZonedDateTime"`: a date-time with an optional
 *   offset and a required IANA time zone (or offset) in brackets, e.g.
 *   `2024-02-29T10:30:00+01:00[Europe/Madrid]`.
 */
export interface TemporalArgumentConstraint extends BaseArgumentConstraint {
  type:
    | "duration"
    | "plain-date"
    | "PlainDate"
    | "plain-time"
    | "PlainTime"
    | "plain-date-time"
    | "PlainDateTime"
    | "instant"
    | "Instant"
    | "plain-year-month"
    | "PlainYearMonth"
    | "plain-month-day"
    | "PlainMonthDay"
    | "zoned-date-time"
    | "ZonedDateTime";
}

/**
 * A constraint on a Unix epoch `number` argument holding an integer count of
 * seconds (`"epoch-seconds"`, alias `"unix"`) or milliseconds
 * (`"epoch-milliseconds"`) since 1970-01-01T00:00:00Z. The value must be an
 * instant `Temporal.Instant.fromEpochMilliseconds()` accepts; `gte`/`gt`/
 * `lte`/`lt` bound it in the same unit.
 */
export interface EpochNumberArgumentConstraint extends BaseArgumentConstraint {
  type:
    | "epoch-seconds"
    | "EpochSeconds"
    | "unix"
    | "epoch-milliseconds"
    | "EpochMilliseconds";
  gte?: number;
  gt?: number;
  lte?: number;
  lt?: number;
}

/**
 * A constraint on a Unix epoch `bigint` argument holding nanoseconds since
 * 1970-01-01T00:00:00Z (`Temporal.Instant.fromEpochNanoseconds()`).
 */
export interface EpochNanosecondsArgumentConstraint extends BaseArgumentConstraint {
  type: "epoch-nanoseconds" | "EpochNanoseconds";
  gte?: bigint;
  gt?: bigint;
  lte?: bigint;
  lt?: bigint;
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
  | TemporalArgumentConstraint
  | EpochNumberArgumentConstraint
  | EpochNanosecondsArgumentConstraint
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
  /**
   * Escape hatch: arbitrary custom logic for every directive this body's
   * path matches, e.g. `{ "/path": { evaluation: (directive) => [...] } }`.
   * Runs in addition to (not instead of) `required`/`max`/`min`/`and`/
   * sub-paths/argument selectors on the same body.
   */
  evaluation?: (directive: Directive) => Iterable<LintIssue>;
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
 * A rule document. Its usual shape keys each rule by a directive path
 * (optionally fused with an argument selector, e.g. `"/server/route[2]"`),
 * with each value either a full rule body or, for a fused `path[N]` key, a
 * bare argument constraint.
 *
 * The root itself also accepts `or`, `and`, and `not` directly — combining
 * whole documents as alternatives (`or`), requirements (`and`), or a
 * negation (`not`), the same way those combinators work one level down for
 * constraints and rule bodies. E.g. `{ "or": [{ "/a": {...} }, { "/b":
 * {...} }] }` accepts a document matching either shape. These compose with
 * path keys on the same object, though typically a document uses one or
 * the other.
 */
export interface LintRuleDocument {
  or?: readonly LintRuleDocument[];
  and?: readonly LintRuleDocument[];
  not?: LintRuleDocument;
  /**
   * Overrides the issues reported when none of `or`'s alternatives pass: a
   * single issue with this message (and `severity`, default `"error"`)
   * replaces the failing alternatives' own issues. Ignored without `or`.
   */
  message?: string;
  severity?: RuleSeverity;
  /**
   * Escape hatch: arbitrary custom logic for the document root itself, e.g.
   * `{ evaluation: (directive) => [...] }` — mirrors `RuleBody.evaluation`,
   * scoped to the root instead of some sub-path's matches.
   */
  evaluation?: (directive: Directive) => Iterable<LintIssue>;
  readonly [path: SubPathSelector]: RuleBody | ArgumentConstraint;
}

/**
 * The equivalent shape: an array of one-entry documents, each keyed by its
 * own path — e.g. `[{ "/server/port": { required: true } }]`.
 */
export type LintRuleArray = readonly LintRuleDocument[];
