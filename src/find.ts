import type { Directive } from "./don.js";
import { PathExpression } from "./path-expression/path-expression.js";
import { ROOT_DIRECTIVE_NAME } from "./root-directive-name.js";

const topLevelDirectives = (root: Directive): Directive[] =>
  root.name === ROOT_DIRECTIVE_NAME ? root.children : [root];

const search = (
  directives: Directive[],
  expression: PathExpression,
  positionSegment: number,
): Directive[] => {
  const matched = directives.filter((directive) =>
    PathExpression.match(directive, expression, positionSegment),
  );

  return positionSegment === expression.parts.length - 1
    ? matched
    : matched.flatMap((directive) =>
        search(directive.children, expression, positionSegment + 1),
      );
};

/** Runs `search` for one `|`-free alternative (ignores `alternatives` itself). */
const searchAlternative = (
  root: Directive,
  alternative: PathExpression,
): Directive[] =>
  alternative.parts.length === 0
    ? [root]
    : search(topLevelDirectives(root), alternative, 0);

/**
 * Runs `searchAlternative` for `expression` and, in order, every one of
 * its `alternatives` (from a top-level `/foo|/biz` in the source path),
 * concatenating the results — the OR of several whole paths.
 */
const findAllFromExpression = (
  root: Directive,
  expression: PathExpression,
): Directive[] =>
  [expression, ...(expression.alternatives ?? [])].flatMap((alternative) =>
    searchAlternative(root, alternative),
  );

/**
 * Finds every directive matching an absolute path from the document root
 * (see `PathExpression` for the full path syntax):
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
 * - `"/server/route(api*)"` and friends — a segment or argument name may
 *   itself contain `*` for a prefix/suffix/multi-chunk pattern instead of
 *   an exact match; see `PathExpression`'s `PatternNode`.
 * - `"/server/route{/auth(on)}"` — `route` children of `server` that have
 *   some descendant matching `/auth(on)`; the `{...}` group filters which
 *   `route`s match without changing what's returned — it's still the
 *   `route`, not the `auth` directive itself.
 * - `"/server/route{/auth}{/respond}"` — stacking `{...}` groups is an
 *   AND: only `route`s that have both an `auth` and a `respond` descendant.
 * - `"/server/route(GET)(text/*)"` — stacking `(...)` groups is likewise an
 *   AND: every group independently constrains `directive.args` in full.
 * - `"/server/route|/server/proxy"` — a top-level `|` (outside any
 *   `(...)`/`{...}` group) is an OR of whole paths: every `route` and every
 *   `proxy` child of `server`, concatenated in that order.
 * - `"/server/route(GET|POST)"` — `|` inside a segment name or a single
 *   `(...)` token is an OR of alternative values for that one name/argument.
 */
export const findAllDirectives = (root: Directive, path: string): Directive[] =>
  findAllFromExpression(root, PathExpression.parse(path));

/**
 * Finds the first directive matching an absolute path (see
 * `findAllDirectives` for the path syntax), or `undefined` if none match.
 */
export const findDirective = (
  root: Directive,
  path: string,
): Directive | undefined => findAllDirectives(root, path)[0];

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
 * `"/server/route(/home)[1]"`) to return that directive's argument at
 * position `N` instead of the directive itself. **Positions are 1-based**
 * — `[1]` is the first argument, matching `directive.args[0]` — the same
 * convention the lint rule schema's own `[N]` selectors use (see
 * `docs/lint/rules.md`). Returns `undefined` when the directive isn't
 * found, or when the argument position is out of range.
 */
export const atDirective = <P extends string>(
  root: Directive,
  path: P,
): AtPathResult<P> => {
  const expression = PathExpression.parse(path);

  for (const alternative of [expression, ...(expression.alternatives ?? [])]) {
    const directive = searchAlternative(root, alternative)[0];
    if (!directive) continue;

    return (
      alternative.selectArgument === undefined
        ? directive
        : directive.args[alternative.selectArgument - 1]
    ) as AtPathResult<P>;
  }

  return undefined as AtPathResult<P>;
};
