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

/**
 * A `|`-separated set of alternative literal/pattern values, from a
 * segment name or `(...)` argument token like `tar|biz` or `api*|admin*`.
 * Matches when any one `option` matches.
 */
export type OrNode = {
  type: "or";
  options: (LiteralNode | PatternNode)[];
};

/** Nodes valid as a path segment's name, or as one of its arguments. */
export type ValueNode = LiteralNode | PatternNode | OrNode;

/**
 * One segment within a path: `segment` is its name, `args` is the list of
 * `(...)` argument groups the segment carries (absent when it carries
 * none at all, as opposed to `[[]]` for a single explicit, empty `()`) —
 * more than one entry comes from stacking groups directly (`name(a)(b)`),
 * every entry must independently match `directive.args` in full (an AND),
 * and `contains` is the list of nested `PathExpression`s parsed from the
 * segment's `{...}` groups (same stacking, same AND — absent when there
 * are none). `contains` doesn't change which directive matches — it's a
 * filter: the directive must have some descendant, reachable by walking
 * `children` the same way a normal path does, that matches each `contains`
 * entry (see `PathExpression.match`).
 */
export type PathNode = {
  segment: ValueNode;
  args?: ValueNode[][];
  contains?: PathExpression[];
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
  /**
   * Alternative whole-path expressions this one is OR'd with, from a
   * top-level `|` in the source path (outside any `(...)`/`{...}` group,
   * e.g. `/foo|/biz`) — absent when there's no such `|`. `PathExpression`
   * itself (`parse`/`match`) never looks at this field; it only ever
   * matches/searches its own `parts`. A caller that needs the OR (`find`'s
   * `findAllDirectives`/`atDirective`, or `matchesContains` below, for a
   * `{...}` group's own top-level `|`) tries this expression and each of
   * `alternatives` in turn and combines the results.
   */
  alternatives?: PathExpression[];
};

const unescape = (value: string): string => value.replace(/\\(.)/g, "$1");

/**
 * Splits `raw` on every unescaped occurrence of `separator` that's also
 * outside any `(...)`/`{...}` group (so a group's own `/` or `|` stays
 * part of it even when the group spans multiple would-be pieces), keeping
 * a `\`-escaped pair intact throughout.
 */
const splitTopLevel = (raw: string, separator: string): string[] => {
  const pieces: string[] = [];
  let current = "";
  let depth = 0;

  for (let i = 0; i < raw.length; i++) {
    const char = raw[i]!;

    if (char === "\\" && i + 1 < raw.length) {
      current += char + raw[i + 1];
      i++;
      continue;
    }

    if (char === "(" || char === "{") depth++;
    if (char === ")" || char === "}") depth--;

    if (char === separator && depth === 0) {
      pieces.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  pieces.push(current);
  return pieces;
};

/**
 * Splits a `/`-separated path into its top-level segments, treating a
 * segment's `(...)` argument group and `{...}` nested-path group as part
 * of that segment even when the group itself contains a `/`, and treating
 * `\` followed by any character as that literal character rather than a
 * separator or a group delimiter. Empty segments (a leading/doubled `/`)
 * are dropped.
 */
const splitPathSegments = (path: string): string[] =>
  splitTopLevel(path, "/").filter((segment) => segment.length > 0);

/**
 * Splits `raw` on every unescaped occurrence of `separator`, keeping a
 * `\`-escaped pair intact (so an escaped separator ends up in the chunk
 * instead of splitting it). Unlike `splitTopLevel`, this doesn't track
 * `(...)`/`{...}` groups — it's only ever used on text that's already
 * inside one, or that can't contain one (a `*`-tokenized value, a single
 * `(...)` argument token).
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
 * Parses one `*`-tokenized value (no `|` alternation) into a `LiteralNode`
 * or `PatternNode`: no `*` is a literal, any `*` is a `pattern` built from
 * the piece before the first `*` (`prefix`), the piece after the last `*`
 * (`suffix`), and the pieces between intermediate `*`s (`chunks`, when
 * there are two or more wildcards) — each omitted when empty/absent.
 */
const parseSingleValueToken = (raw: string): LiteralNode | PatternNode => {
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
 * Parses a single `*`-tokenized value — a plain path segment, or one
 * whitespace-separated token inside an `(...)` args group — into a
 * `ValueNode`. Splits on `|` first: with no `|` this is exactly
 * `parseSingleValueToken`'s literal/pattern result; with one or more `|`s
 * each side is parsed the same way and the result is an `OrNode` listing
 * them as alternatives (e.g. `tar|biz`, `api*|admin*`).
 */
const parseValueToken = (raw: string): ValueNode => {
  const options = splitUnescaped(raw, "|");

  return options.length === 1
    ? parseSingleValueToken(options[0]!)
    : { type: "or", options: options.map(parseSingleValueToken) };
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
 * Splits one path segment into its name and every `(...)` args group and
 * `{...}` nested-path group it carries, in the order they appear —
 * `name(a)(b){x}{y}`, with either list empty when the segment carries no
 * such group. `\` escapes the character right after it throughout,
 * including inside `name`, so a literal `(`, `)`, `{`, or `}` can be part
 * of a name.
 */
const scanSegment = (
  segment: string,
): { name: string; argGroups: string[]; nestedGroups: string[] } => {
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

  const argGroups: string[] = [];
  const nestedGroups: string[] = [];

  while (i < segment.length) {
    if (segment[i] === "(") {
      const { content, nextIndex } = scanBalancedGroup(segment, i, "(", ")");
      argGroups.push(content);
      i = nextIndex;
      continue;
    }

    if (segment[i] === "{") {
      const { content, nextIndex } = scanBalancedGroup(segment, i, "{", "}");
      nestedGroups.push(content);
      i = nextIndex;
      continue;
    }

    break;
  }

  return { name, argGroups, nestedGroups };
};

/** Parses one `(...)` group's trimmed content into its list of argument tokens. */
const parseArgGroup = (raw: string): ValueNode[] => {
  const trimmed = raw.trim();
  return trimmed === "" ? [] : trimmed.split(/\s+/).map(parseValueToken);
};

const parseSegment = (segment: string): PathNode => {
  const { name, argGroups, nestedGroups } = scanSegment(segment);

  return {
    segment: parseValueToken(name),
    ...(argGroups.length > 0 ? { args: argGroups.map(parseArgGroup) } : {}),
    ...(nestedGroups.length > 0
      ? { contains: nestedGroups.map(parsePathExpression) }
      : {}),
  };
};

const isPathExpression = (value: unknown): value is PathExpression =>
  typeof value === "object" &&
  value !== null &&
  Array.isArray((value as { parts?: unknown }).parts);

const trailingArgIndexPattern = /\[(\d+)\]$/;

/** Parses one `|`-free path string (with its own optional trailing `[N]`) into a `PathExpression`. */
function parseSinglePathExpression(input: string): PathExpression {
  const match = trailingArgIndexPattern.exec(input);
  if (!match) return { parts: splitPathSegments(input).map(parseSegment) };

  return {
    parts: splitPathSegments(input.slice(0, match.index)).map(parseSegment),
    selectArgument: Number(match[1]),
  };
}

/**
 * Parses a raw path string into a `PathExpression` (see `PathExpression.parse`
 * for the string-or-already-parsed public entry point). Hoisted so it can be
 * called from `parseSegment`/`scanSegment` above, for a `{...}` group's own
 * nested path — the same syntax, parsed the same way, one level down. Splits
 * on every top-level `|` first (`/foo|/biz`) — each side is parsed on its
 * own via `parseSinglePathExpression`, and, when there's more than one, the
 * first side's result carries the rest as `alternatives`.
 */
function parsePathExpression(input: string): PathExpression {
  const [primary, ...rest] = splitTopLevel(input, "|").map(
    parseSinglePathExpression,
  );

  return rest.length > 0 ? { ...primary!, alternatives: rest } : primary!;
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

const matchesValue = (value: string, node: ValueNode): boolean => {
  switch (node.type) {
    case "literal":
      return value === node.value;
    case "pattern":
      return patternToRegExp(node).test(value);
    case "or":
      return node.options.some((option) => matchesValue(value, option));
  }
};

/**
 * Checks whether `directive` has a descendant matching `expression` (or
 * any of its `alternatives`) in full, reached by walking `children` down
 * through each part in turn — the same way a path descends from the
 * document root, but starting one level down, at `directive`'s own
 * children. Backs one `{...}` group of a `contains` filter: it only
 * reports whether such a descendant exists, it doesn't select or return
 * it.
 */
function matchesContainsGroup(
  directive: Directive,
  expression: PathExpression,
): boolean {
  const matchesOne = (alt: PathExpression): boolean => {
    if (alt.parts.length === 0) return true;

    const search = (
      directives: Directive[],
      positionSegment: number,
    ): boolean =>
      directives.some((child) => {
        if (!PathExpression.match(child, alt, positionSegment)) return false;

        return positionSegment === alt.parts.length - 1
          ? true
          : search(child.children, positionSegment + 1);
      });

    return search(directive.children, 0);
  };

  return [expression, ...(expression.alternatives ?? [])].some(matchesOne);
}

/** Checks every `{...}` group in `contains` against `directive` — an AND across groups. */
const matchesContains = (
  directive: Directive,
  contains: PathExpression[],
): boolean => contains.every((group) => matchesContainsGroup(directive, group));

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
   * `directive.children` or advance through the rest of `parts` itself,
   * and it doesn't consider `expression.alternatives` (a caller tries
   * those separately); that's left to whatever traversal calls this once
   * per level.
   *
   * An expression with no parts at all (`"/"`, `""`, or a bare `[N]`
   * selector) imposes no constraint and always matches. Otherwise,
   * `directive.name` must match the node's `segment`; when the node also
   * carries `args` (its source had one or more `(...)` groups), every
   * group must independently match `directive.args` in full — same
   * length, each token matching pairwise (an AND across groups; a node
   * with no `args` at all matches regardless of `directive.args`). When
   * the node also carries `contains` (its source had one or more `{...}`
   * groups), `directive` must additionally have, for every group, some
   * descendant matching it or one of its `|` alternatives (see
   * `matchesContains`) — the groups filter which directives match, they
   * don't change which one does.
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
      const allGroupsMatch = node.args.every(
        (group) =>
          directive.args.length === group.length &&
          group.every((argNode, index) =>
            matchesValue(String(directive.args[index]), argNode),
          ),
      );
      if (!allGroupsMatch) return false;
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
