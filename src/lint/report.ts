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
import type { LintIssue, LintSeverity } from "./issue.js";

export interface RenderReportOptions {
  /** Shown as the report's header line, e.g. the linted file's path. */
  filePath: string;
  /**
   * Colors the header, each row's severity, and the summary line with ANSI
   * escape codes.
   * @default false
   */
  asciiColor?: boolean;
}

const ANSI = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
} as const;

const SEVERITY_COLOR: Record<LintSeverity, string> = {
  error: ANSI.red,
  warning: ANSI.yellow,
  info: ANSI.cyan,
};

const colorize = (text: string, color: string): string =>
  `${color}${text}${ANSI.reset}`;

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
  const asciiColor = options.asciiColor ?? false;

  const rows = issues.map((issue) => ({
    location: locationOf(issue),
    severity: issue.severity,
    message: issue.message,
  }));

  const locationWidth = Math.max(0, ...rows.map((row) => row.location.length));
  const severityWidth = Math.max(0, ...rows.map((row) => row.severity.length));

  const lines = rows.map((row) => {
    const location = row.location.padStart(locationWidth);
    const severity = row.severity.padEnd(severityWidth);
    return `  ${asciiColor ? colorize(location, ANSI.dim) : location}  ${
      asciiColor ? colorize(severity, SEVERITY_COLOR[row.severity]) : severity
    }  ${row.message}`;
  });

  const errors = issues.filter((issue) => issue.severity === "error").length;
  const warnings = issues.filter(
    (issue) => issue.severity === "warning",
  ).length;
  const infos = issues.filter((issue) => issue.severity === "info").length;

  const summary = [
    asciiColor && errors > 0
      ? colorize(pluralize(errors, "error"), ANSI.red)
      : pluralize(errors, "error"),
    asciiColor && warnings > 0
      ? colorize(pluralize(warnings, "warning"), ANSI.yellow)
      : pluralize(warnings, "warning"),
    asciiColor && infos > 0
      ? colorize(`${infos} info`, ANSI.cyan)
      : `${infos} info`,
  ].join(" ");

  return [
    asciiColor ? colorize(options.filePath, ANSI.bold) : options.filePath,
    ...lines,
    "",
    summary,
  ].join("\n");
};
