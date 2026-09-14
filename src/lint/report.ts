/**
 * Renders `LintIssue[]` as a human-readable, ESLint-style report:
 *
 * ```
 * my-file.donly
 *   2:4  error  puerto debe ser un número
 *
 * 1 error 0 warnings 0 info
 * ```
 */
import type { LintIssue } from "./issue.js";

export interface RenderReportOptions {
  /** Shown as the report's header line, e.g. the linted file's path. */
  filePath: string;
}

/** `"line:column"` (1-based) from an issue's `loc`, or `"-"` when it has none. */
const locationOf = (issue: LintIssue): string => {
  if (!issue.loc) return "-";
  const { line, column } = issue.loc.start.span.startLocation;
  return `${line + 1}:${column + 1}`;
};

const pluralize = (count: number, word: string): string =>
  `${count} ${word}${count === 1 ? "" : "s"}`;

/**
 * Renders `issues` as a report headed by `options.filePath`, one indented
 * `line:column  severity  message` row per issue (columns aligned), and a
 * trailing summary line counting errors, warnings, and infos.
 */
export const renderReport = (
  issues: LintIssue[],
  options: RenderReportOptions,
): string => {
  const rows = issues.map((issue) => ({
    location: locationOf(issue),
    severity: issue.severity,
    message: issue.message,
  }));

  const locationWidth = Math.max(0, ...rows.map((row) => row.location.length));
  const severityWidth = Math.max(0, ...rows.map((row) => row.severity.length));

  const lines = rows.map(
    (row) =>
      `  ${row.location.padStart(locationWidth)}  ${row.severity.padEnd(
        severityWidth,
      )}  ${row.message}`,
  );

  const errors = issues.filter((issue) => issue.severity === "error").length;
  const warnings = issues.filter(
    (issue) => issue.severity === "warning",
  ).length;
  const infos = issues.filter((issue) => issue.severity === "info").length;

  return [
    options.filePath,
    ...lines,
    "",
    `${pluralize(errors, "error")} ${pluralize(warnings, "warning")} ${infos} info`,
  ].join("\n");
};
