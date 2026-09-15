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
 * as opposed to `[]` for an explicit, empty `()`), and `contains` is a
 * nested `PathExpression` parsed from a trailing `{...}` group, when the
 * segment carries one. `contains` doesn't change which directive matches
 * — it's a filter: the directive must have some descendant, reachable by
 * walking `children` the same way a normal path does, that matches
 * `contains` (see `PathExpression.match`).
 */
export type PathNode = {
  segment: ValueNode;
  args?: ValueNode[];
  contains?: PathExpression;
};

/** The root structure returned by the parser. */
export type PathExpression = {
  parts: PathNode[];
  /**
   * The 1-based argument position parsed from a trailing `[N]` on the
   * path string (e.g. `/foo[1]` is that directive's first argument),
   * absent when there is none. It's purely informative — carried along,
   * still 1-based, for a caller that wants to select an argument off
   * whatever directive ends up matching `parts` (see `atDirective` in
   * `../find.js`, and the lint rule schema's own `[N]` selectors in
   * `docs/lint/rules.md`) — and plays no part in `PathExpression`'s own
   * matching rules.
   */
  selectArgument?: number;
};

const unescape = (value: string): string => value.replace(/\\(.)/g, "$1");

/**
 * Splits a `/`-separated path into its top-level segments, treating a
 * segment's `(...)` argument group and `{...}` nested-path group as part
 * of that segment even when the group itself contains a `/`, and treating
 * `\` followed by any character as that literal character rather than a
 * separator or a group delimiter.
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

    if (char === "(" || char === "{") depth++;
    if (char === ")" || char === "}") depth--;

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

/**
 * Scans past a `\`-escaped-aware balanced group opened by `open` (its
 * matching close is `close`), starting right after `openIndex` (which
 * must point at `open`). Returns the group's inner text and the index of
 * the character right after its closing delimiter. Nested `open`/`close`
 * pairs inside the group are tracked so an inner group's own delimiters
 * don't end the outer one early.
 */
const scanBalancedGroup = (
  raw: string,
  openIndex: number,
  open: string,
  close: string,
): { content: string; nextIndex: number } => {
  let depth = 1;
  let content = "";
  let i = openIndex + 1;

  while (i < raw.length && depth > 0) {
    const char = raw[i]!;

    if (char === "\\" && i + 1 < raw.length) {
      content += char + raw[i + 1];
      i += 2;
      continue;
    }

    if (char === open) depth++;
    if (char === close) {
      depth--;
      if (depth === 0) {
        i++;
        break;
      }
    }

    content += char;
    i++;
  }

  return { content, nextIndex: i };
};

/**
 * Splits one path segment into its name, an optional `(...)` args group,
 * and an optional trailing `{...}` nested-path group — `name(args){nested}`,
 * with `args`/`nested` each absent when the segment carries no such group.
 * `\` escapes the character right after it throughout, including inside
 * `name`, so a literal `(`, `)`, `{`, or `}` can be part of a name.
 */
const scanSegment = (
  segment: string,
): { name: string; argsGroup?: string; nestedGroup?: string } => {
  let name = "";
  let i = 0;

  while (i < segment.length) {
    const char = segment[i]!;

    if (char === "\\" && i + 1 < segment.length) {
      name += char + segment[i + 1];
      i += 2;
      continue;
    }

    if (char === "(" || char === "{") break;
    name += char;
    i++;
  }

  let argsGroup: string | undefined;
  if (segment[i] === "(") {
    const { content, nextIndex } = scanBalancedGroup(segment, i, "(", ")");
    argsGroup = content;
    i = nextIndex;
  }

  let nestedGroup: string | undefined;
  if (segment[i] === "{") {
    const { content, nextIndex } = scanBalancedGroup(segment, i, "{", "}");
    nestedGroup = content;
    i = nextIndex;
  }

  return { name, argsGroup, nestedGroup };
};

const parseSegment = (segment: string): PathNode => {
  const { name, argsGroup, nestedGroup } = scanSegment(segment);
  const trimmedArgsGroup = argsGroup?.trim();

  return {
    segment: parseValueToken(name),
    ...(argsGroup !== undefined
      ? {
          args:
            trimmedArgsGroup === ""
              ? []
              : trimmedArgsGroup!.split(/\s+/).map(parseValueToken),
        }
      : {}),
    ...(nestedGroup !== undefined
      ? { contains: parsePathExpression(nestedGroup) }
      : {}),
  };
};

const isPathExpression = (value: unknown): value is PathExpression =>
  typeof value === "object" &&
  value !== null &&
  Array.isArray((value as { parts?: unknown }).parts);

const trailingArgIndexPattern = /\[(\d+)\]$/;

/**
 * Parses a raw path string into a `PathExpression` (see `PathExpression.parse`
 * for the string-or-already-parsed public entry point). Hoisted so it can be
 * called from `parseSegment`/`scanSegment` above, for a `{...}` group's own
 * nested path — the same syntax, parsed the same way, one level down.
 */
function parsePathExpression(input: string): PathExpression {
  const match = trailingArgIndexPattern.exec(input);
  if (!match) return { parts: splitPathSegments(input).map(parseSegment) };

  return {
    parts: splitPathSegments(input.slice(0, match.index)).map(parseSegment),
    selectArgument: Number(match[1]),
  };
}

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

/**
 * Checks whether `directive` has a descendant matching `expression` in
 * full, reached by walking `children` down through each of its parts in
 * turn — the same way a path descends from the document root, but
 * starting one level down, at `directive`'s own children. Backs a
 * `{...}` group's `contains` filter: it only reports whether such a
 * descendant exists, it doesn't select or return it.
 */
function matchesContains(
  directive: Directive,
  expression: PathExpression,
): boolean {
  if (expression.parts.length === 0) return true;

  const search = (directives: Directive[], positionSegment: number): boolean =>
    directives.some((child) => {
      if (!PathExpression.match(child, expression, positionSegment))
        return false;

      return positionSegment === expression.parts.length - 1
        ? true
        : search(child.children, positionSegment + 1);
    });

  return search(directive.children, 0);
}

export const PathExpression = {
  /**
   * Parses a path string into a `PathExpression`, or returns `input`
   * unchanged when it's already one — so callers can accept either a raw
   * string or an already-parsed expression without checking themselves.
   */
  parse(input: string | PathExpression): PathExpression {
    return isPathExpression(input) ? input : parsePathExpression(input);
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
   * `directive.args` must have the same length and match pairwise — a
   * node with no `args` at all matches regardless of `directive.args`.
   * When the node also carries `contains` (its source had a trailing
   * `{...}` group), `directive` must additionally have some descendant
   * matching it (see `matchesContains`) — the group filters which
   * directives match, it doesn't change which one does.
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

    if (node.args !== undefined) {
      const argsMatch =
        directive.args.length === node.args.length &&
        node.args.every((argNode, index) =>
          matchesValue(String(directive.args[index]), argNode),
        );
      if (!argsMatch) return false;
    }

    if (
      node.contains !== undefined &&
      !matchesContains(directive, node.contains)
    ) {
      return false;
    }

    return true;
  },
};
