import type { Directive } from "../don.js";

/**
 * A `*`-tokenized value: `prefix`/`suffix` are the text before the first
 * and after the last `*` (absent when empty), and `chunks` are the pieces
 * between intermediate `*`s, for two or more wildcards (absent otherwise).
 * A bare `*` is a `pattern` with all three absent.
 */
export type PatternNode = {
  type: "pattern";
  prefix?: string;
  chunks?: string[];
  suffix?: string;
};

export type LiteralNode = {
  type: "literal";
  value: string;
};

/** Nodes valid as a path segment's name, or as one of its arguments. */
export type ValueNode = LiteralNode | PatternNode;

/**
 * One segment within a path: `segment` is its name, `args` is its
 * `(...)` argument list when the segment carries one (absent otherwise,
 * as opposed to `[]` for an explicit, empty `()`).
 */
export type PathNode = {
  segment: ValueNode;
  args?: ValueNode[];
};

/** The root structure returned by the parser. */
export type PathExpression = {
  parts: PathNode[];
  /**
   * An argument index parsed from a trailing `[N]` on the path string
   * (e.g. `/foo[1]`), absent when there is none. It's purely informative
   * — carried along for a caller that wants to select an argument off
   * whatever directive ends up matching `parts` — and plays no part in
   * `PathExpression`'s own matching rules.
   */
  selectArgument?: number;
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
 * `ValueNode`: no `*` is a literal, any `*` is a `pattern` built from the
 * piece before the first `*` (`prefix`), the piece after the last `*`
 * (`suffix`), and the pieces between intermediate `*`s (`chunks`, when
 * there are two or more wildcards) — each omitted when empty/absent.
 */
const parseValueToken = (raw: string): ValueNode => {
  const pieces = splitUnescaped(raw, "*").map(unescape);

  if (pieces.length === 1) {
    return { type: "literal", value: pieces[0]! };
  }

  const prefix = pieces[0]!;
  const suffix = pieces[pieces.length - 1]!;
  const chunks = pieces.slice(1, -1);

  return {
    type: "pattern",
    ...(prefix !== "" ? { prefix } : {}),
    ...(chunks.length > 0 ? { chunks } : {}),
    ...(suffix !== "" ? { suffix } : {}),
  };
};

const segmentWithArgsPattern = /^((?:\\.|[^/()])+)\(((?:\\.|[^)])*)\)$/;

const parseSegment = (segment: string): PathNode => {
  const match = segmentWithArgsPattern.exec(segment);
  if (!match) return { segment: parseValueToken(segment) };

  const [, name, argsGroup] = match;
  const trimmedArgsGroup = argsGroup!.trim();

  return {
    segment: parseValueToken(name!),
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

const trailingArgIndexPattern = /\[(\d+)\]$/;

const escapeRegExp = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Builds the regex a `PatternNode` stands for: `prefix` anchored at the
 * start, `suffix` anchored at the end, and `chunks` required to occur (in
 * order) somewhere in between — the same shape `parseValueToken` split the
 * original `*`-tokenized string into, reassembled with `.*` standing in
 * for each `*`. A bare pattern (all three absent) becomes `^.*$`.
 */
const patternToRegExp = (node: PatternNode): RegExp => {
  const pieces = [node.prefix ?? "", ...(node.chunks ?? []), node.suffix ?? ""];
  return new RegExp(`^${pieces.map(escapeRegExp).join(".*")}$`);
};

const matchesValue = (value: string, node: ValueNode): boolean =>
  node.type === "literal"
    ? value === node.value
    : patternToRegExp(node).test(value);

export const PathExpression = {
  /**
   * Parses a path string into a `PathExpression`, or returns `input`
   * unchanged when it's already one — so callers can accept either a raw
   * string or an already-parsed expression without checking themselves.
   */
  parse(input: string | PathExpression): PathExpression {
    if (isPathExpression(input)) return input;

    const match = trailingArgIndexPattern.exec(input);
    if (!match) return { parts: splitPathSegments(input).map(parseSegment) };

    return {
      parts: splitPathSegments(input.slice(0, match.index)).map(parseSegment),
      selectArgument: Number(match[1]),
    };
  },

  /**
   * Checks a single `directive` against the one `PathNode` at
   * `expression.parts[positionSegment]` — it doesn't walk
   * `directive.children` or advance through the rest of `parts` itself;
   * that's left to whatever traversal calls this once per level.
   *
   * An expression with no parts at all (`"/"`, `""`, or a bare `[N]`
   * selector) imposes no constraint and always matches. Otherwise,
   * `directive.name` must match the node's `segment`; when the node also
   * carries `args` (its source had a `(...)` group, even an empty one),
   * `directive.args` must have the same length and match pairwise —
   * a node with no `args` at all matches regardless of `directive.args`.
   */
  match(
    directive: Directive,
    expression: PathExpression,
    positionSegment: number,
  ): boolean {
    if (expression.parts.length === 0) return true;

    const node = expression.parts[positionSegment];
    if (!node) return false;

    if (!matchesValue(String(directive.name), node.segment)) return false;
    if (node.args === undefined) return true;

    return (
      directive.args.length === node.args.length &&
      node.args.every((argNode, index) =>
        matchesValue(String(directive.args[index]), argNode),
      )
    );
  },
};
