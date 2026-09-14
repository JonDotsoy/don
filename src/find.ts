import type { Directive } from "./don.js";
import { ROOT_DIRECTIVE_NAME } from "./root-directive-name.js";

interface PathSegment {
  name: string;
  /**
   * `undefined` when the segment carries no `(...)` group, meaning any args
   * match. Otherwise one pattern per required argument, in order: `"*"`
   * matches any value at that position, anything else must equal
   * `String(directive.args[index])` exactly. A directive only matches when
   * `args.length` equals the number of patterns.
   */
  argPatterns?: string[];
}

/**
 * Splits an absolute directive path into its `/`-separated segments,
 * treating a segment's `(...)` argument group as part of that segment even
 * when the group itself contains a `/` (e.g. `route(/home)`), and treating
 * `\` followed by any character as that literal character rather than a
 * separator or group delimiter (e.g. `\/user` is the single segment
 * `/user`, matching a directive whose own name contains a `/` — DON
 * identifiers may include `/`, see spec §2.3).
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

// The name/args halves still carry their `\`-escapes at this point (e.g. a
// name of `\/user`) — the character classes below only need to exclude an
// *unescaped* `/`, `(`, or `)`, so `\\.` (an escaped pair) is accepted as a
// unit alongside any other single character outside that exclusion set.
const segmentPattern = /^((?:\\.|[^/()])+)(?:\(((?:\\.|[^)])*)\))?$/;

const unescape = (value: string): string => value.replace(/\\(.)/g, "$1");

const parseSegment = (segment: string): PathSegment => {
  const match = segmentPattern.exec(segment);
  if (!match) {
    throw new Error(
      `Invalid directive path segment: ${JSON.stringify(segment)}`,
    );
  }

  const [, name, argsGroup] = match;
  const trimmedArgsGroup = argsGroup?.trim();

  return {
    name: unescape(name!),
    argPatterns:
      trimmedArgsGroup === undefined
        ? undefined
        : trimmedArgsGroup.length === 0
          ? []
          : trimmedArgsGroup.split(/\s+/).map(unescape),
  };
};

/**
 * Parses an absolute, `/`-separated directive path (e.g.
 * `"/server/route(* /api/user)"`) into one `PathSegment` per path
 * component. An empty path (`"/"` or `""`) parses to no segments, meaning
 * "the document root itself".
 */
const parsePath = (path: string): PathSegment[] =>
  splitPathSegments(path).map(parseSegment);

const matchesArgs = (
  args: Directive["args"],
  argPatterns: string[] | undefined,
): boolean =>
  argPatterns === undefined ||
  (args.length === argPatterns.length &&
    argPatterns.every(
      (pattern, index) => pattern === "*" || String(args[index]) === pattern,
    ));

const matchesSegment = (directive: Directive, segment: PathSegment): boolean =>
  String(directive.name) === segment.name &&
  matchesArgs(directive.args, segment.argPatterns);

const search = (
  directives: Directive[],
  segments: PathSegment[],
): Directive[] => {
  const [segment, ...rest] = segments;
  if (!segment) return directives;

  const matched = directives.filter((directive) =>
    matchesSegment(directive, segment),
  );

  return rest.length === 0
    ? matched
    : matched.flatMap((directive) => search(directive.children, rest));
};

const topLevelDirectives = (root: Directive): Directive[] =>
  root.name === ROOT_DIRECTIVE_NAME ? root.children : [root];

/**
 * Finds every directive matching an absolute path from the document root:
 *
 * - `"/"` — the document root itself.
 * - `"/server"` — every top-level directive named `server`.
 * - `"/server/route"` — every `route` child of a matched `server`.
 * - `"/server/route(/home)"` — those `route` children whose first argument
 *   is exactly `"/home"`.
 * - `"/server/route(* /api/user)"` — `route` children with any first
 *   argument and a second argument exactly `"/api/user"`.
 * - `"/server/\/user"` — a `/user` child, i.e. a directive whose own name is
 *   `/user` (DON identifiers may contain `/`, see spec §2.3); `\` escapes
 *   the character that follows it so it's read literally instead of as a
 *   path separator or a `(`/`)` group delimiter.
 */
export const findAllDirectives = (
  root: Directive,
  path: string,
): Directive[] => {
  const segments = parsePath(path);
  return segments.length === 0
    ? [root]
    : search(topLevelDirectives(root), segments);
};

/**
 * Finds the first directive matching an absolute path (see
 * `findAllDirectives` for the path syntax), or `undefined` if none match.
 */
export const findDirective = (
  root: Directive,
  path: string,
): Directive | undefined => findAllDirectives(root, path)[0];

const trailingArgIndexPattern = /\[(\d+)\]$/;

/**
 * The value type an argument resolves to at runtime: `string`, `number`,
 * `boolean`, `null`, a `HeredocValue`, or `undefined` for an out-of-range
 * index.
 */
type DirectiveArgValue = Directive["args"][number] | undefined;

/**
 * The static return type of `at(path)`/`atDirective(root, path)` for a given
 * path: a path ending in `[N]` (a literal segment, so this can only narrow
 * for a string literal type) resolves to the argument's value, otherwise to
 * the matched `Directive`. A non-literal `string` path can't be checked at
 * compile time, so it types as the union of both possibilities.
 */
export type AtPathResult<P extends string> = string extends P
  ? Directive | DirectiveArgValue
  : P extends `${string}[${number}]`
    ? DirectiveArgValue
    : Directive | undefined;

/**
 * Resolves an absolute path (see `findAllDirectives` for the path syntax),
 * optionally suffixed with `[N]` on the final segment (e.g.
 * `"/server/route(/home)[0]"`) to return that directive's `N`th argument
 * instead of the directive itself. Returns `undefined` when the directive
 * isn't found, or when the argument index is out of range.
 */
export const atDirective = <P extends string>(
  root: Directive,
  path: P,
): AtPathResult<P> => {
  const match = trailingArgIndexPattern.exec(path);
  if (!match) return findDirective(root, path) as AtPathResult<P>;

  const directive = findDirective(root, path.slice(0, match.index));
  return directive?.args[Number(match[1])] as AtPathResult<P>;
};
