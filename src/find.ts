import { Directive } from "./don.js";
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
 * when the group itself contains a `/` (e.g. `route(/home)`).
 */
const splitPathSegments = (path: string): string[] => {
  const segments: string[] = [];
  let current = "";
  let depth = 0;

  for (const char of path) {
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

const segmentPattern = /^([^/()]+)(?:\(([^)]*)\))?$/;

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
    name: name!,
    argPatterns:
      trimmedArgsGroup === undefined
        ? undefined
        : trimmedArgsGroup.length === 0
          ? []
          : trimmedArgsGroup.split(/\s+/),
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
