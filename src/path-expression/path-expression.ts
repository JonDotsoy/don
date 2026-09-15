export type WildcardNode = {
  type: "wildcard";
};

export type PatternNode = {
  type: "pattern";
  prefix?: string;
  suffix?: string;
};

export type MultiPatternNode = {
  type: "multi_pattern";
  chunks: string[];
};

export type LiteralNode = {
  type: "literal";
  value: string;
};

/** Nodes valid as arguments, or as a plain (parenthesis-free) path segment. */
export type ValueNode =
  | LiteralNode
  | WildcardNode
  | PatternNode
  | MultiPatternNode;

export type ArgsNode = {
  type: "args";
  segment: string;
  args: ValueNode[];
};

/** A node representing any one segment within a path. */
export type PathNode = ValueNode | ArgsNode;

/** The root structure returned by the parser. */
export type PathExpression = {
  parts: PathNode[];
};

const unescape = (value: string): string => value.replace(/\\(.)/g, "$1");

/**
 * Splits a `/`-separated path into its top-level segments, treating a
 * segment's `(...)` argument group as part of that segment even when the
 * group itself contains a `/`, and treating `\` followed by any character
 * as that literal character rather than a separator or a group delimiter.
 */
const splitPathSegments = (path: string): string[] => {
  const segments: string[] = [];
  let current = "";
  let depth = 0;

  for (let i = 0; i < path.length; i++) {
    const char = path[i]!;

    if (char === "\\" && i + 1 < path.length) {
      current += char + path[i + 1];
      i++;
      continue;
    }

    if (char === "(") depth++;
    if (char === ")") depth--;

    if (char === "/" && depth === 0) {
      if (current.length > 0) segments.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  if (current.length > 0) segments.push(current);
  return segments;
};

/**
 * Splits `raw` on every unescaped occurrence of `separator`, keeping a
 * `\`-escaped pair intact (so an escaped separator ends up in the chunk
 * instead of splitting it).
 */
const splitUnescaped = (raw: string, separator: string): string[] => {
  const chunks: string[] = [];
  let current = "";

  for (let i = 0; i < raw.length; i++) {
    const char = raw[i]!;

    if (char === "\\" && i + 1 < raw.length) {
      current += char + raw[i + 1];
      i++;
      continue;
    }

    if (char === separator) {
      chunks.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  chunks.push(current);
  return chunks;
};

/**
 * Parses a single `*`-tokenized value — a plain path segment, or one
 * whitespace-separated token inside an `(...)` args group — into a
 * `ValueNode`: no `*` is a literal, a lone `*` is a wildcard, one `*` with
 * content on exactly one side is a prefix/suffix pattern, and anything
 * with content on both sides of a `*` — one `*` with both a prefix and a
 * suffix, or more than one `*` — is a multi-pattern of the chunks between
 * them (a one-sided `pattern` is really just the two-chunk case of that
 * with one chunk empty, so `pattern` stays reserved for it instead of
 * overlapping with `multi_pattern`).
 */
const parseValueToken = (raw: string): ValueNode => {
  const chunks = splitUnescaped(raw, "*").map(unescape);

  if (chunks.length === 1) {
    return { type: "literal", value: chunks[0]! };
  }

  if (chunks.length === 2) {
    const [prefix, suffix] = chunks as [string, string];
    if (prefix === "" && suffix === "") {
      return { type: "wildcard" };
    }

    if (prefix === "") return { type: "pattern", suffix };
    if (suffix === "") return { type: "pattern", prefix };
  }

  return { type: "multi_pattern", chunks };
};

const segmentWithArgsPattern = /^((?:\\.|[^/()])+)\(((?:\\.|[^)])*)\)$/;

const parseSegment = (segment: string): PathNode => {
  const match = segmentWithArgsPattern.exec(segment);
  if (!match) return parseValueToken(segment);

  const [, name, argsGroup] = match;
  const trimmedArgsGroup = argsGroup!.trim();

  return {
    type: "args",
    segment: unescape(name!),
    args:
      trimmedArgsGroup === ""
        ? []
        : trimmedArgsGroup.split(/\s+/).map(parseValueToken),
  };
};

const isPathExpression = (value: unknown): value is PathExpression =>
  typeof value === "object" &&
  value !== null &&
  Array.isArray((value as { parts?: unknown }).parts);

export const PathExpression = {
  /**
   * Parses a path string into a `PathExpression`, or returns `input`
   * unchanged when it's already one — so callers can accept either a raw
   * string or an already-parsed expression without checking themselves.
   */
  parse(input: string | PathExpression): PathExpression {
    if (isPathExpression(input)) return input;
    return { parts: splitPathSegments(input).map(parseSegment) };
  },
};
