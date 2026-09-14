/**
 * Public entry point for the object/JSON-format `LintRuleDocument` engine
 * (see `docs/lint/rules.md`). Re-exports the runtime evaluator and its
 * types from `./lint-schema.ts` / `./schema.ts`.
 */
export { lintSchema, lintSchema as lint } from "./lint-schema.js";
export { renderReport, renderJSONReport } from "./report.js";
export type {
  RenderReportOptions,
  RenderJSONReportOptions,
  JSONReport,
  JSONReportIssue,
} from "./report.js";
export type {
  RuleSeverity,
  ArgumentType,
  ArgumentLiteral,
  BaseArgumentConstraint,
  StringArgumentConstraint,
  NumberArgumentConstraint,
  BigintArgumentConstraint,
  BooleanArgumentConstraint,
  NullArgumentConstraint,
  HeredocArgumentConstraint,
  UntypedArgumentConstraint,
  ArgumentConstraint,
  SubPathSelector,
  ArgumentSelector,
  RuleBody,
  RuleAndEntry,
  LintRuleDocument,
  LintRuleArray,
} from "./schema.js";
export type { LintSeverity, LintLoc, LintIssue } from "./types.js";
