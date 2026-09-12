import { Directive, DirectiveArg } from "./don.js";

/**
 * Array de resultados de `Directive#findAll`. Es un `Array<Directive>`
 * normal (forEach/filter/at/... funcionan igual), salvo que `map` no
 * itera Directive → R sino que aplica `fn(args, directive)` (la misma
 * firma que `Directive#map`) a cada directiva del resultado.
 */
export class ResultMatchDirectives extends Array<Directive> {
  // @ts-expect-error: intencionalmente incompatible con Array#map — ver doc de la clase.
  override map<R>(fn: (args: DirectiveArg[], directive: Directive) => R): R[] {
    return Array.from(this, (directive) => directive.map(fn));
  }
}

interface PathSegment {
  name: string;
  /** Filtro posicional de `[valor, ...]`, o `null` si el segmento no trae. */
  args: string[] | null;
}

/**
 * Parte la ruta por `/`, pero sin romper el contenido entre `[` y `]`
 * (que puede a su vez contener `/`, ej. `router[/users]`).
 */
const splitPath = (path: string): string[] => {
  const segments: string[] = [];
  let current = "";
  let depth = 0;

  for (const char of path) {
    if (char === "[") depth++;
    if (char === "]") depth--;

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

const SEGMENT_RE = /^([^[\]]*)(?:\[(.*)\])?$/;

const parseSegment = (segment: string): PathSegment => {
  const [, name = segment, argsPart] = segment.match(SEGMENT_RE) ?? [];
  return {
    name,
    args:
      argsPart === undefined
        ? null
        : argsPart.split(",").map((value) => value.trim()),
  };
};

const parsePath = (path: string): PathSegment[] =>
  splitPath(path).map(parseSegment);

/** El filtro `[a, b, ...]` calza si `String(args[i]) === valor_i` para cada valor dado. */
const matchesArgs = (directive: Directive, args: string[] | null): boolean =>
  args === null ||
  args.every((value, index) => String(directive.args[index]) === value);

const matchesSegment = (directive: Directive, segment: PathSegment): boolean =>
  directive.name === segment.name && matchesArgs(directive, segment.args);

const matchChildren = (
  directives: Directive[],
  segments: PathSegment[],
): Directive[] => {
  const [segment, ...rest] = segments;
  if (segment === undefined) return directives;

  const matched = directives.filter((d) => matchesSegment(d, segment));
  if (rest.length === 0) return matched;

  return matchChildren(
    matched.flatMap((d) => d.children),
    rest,
  );
};

/**
 * El primer segmento de la ruta puede calzar contra la propia directiva
 * (permitiendo escribir `directive.findAll("/server/router")` sobre la
 * "server" que devuelve `DON.parse`), o, si no calza, se busca directo
 * entre sus `children` (permitiendo `router.findFirst("/respond")` sin
 * repetir el nombre de `router`). Un documento con múltiples directivas
 * de nivel superior (el wrapper sintético `ROOT_DIRECTIVE_NAME`, ver
 * `wrapAsRoot` en `directive-json.ts`) nunca calza consigo mismo — su
 * `name` es un `Symbol` — así que siempre cae en el segundo caso y busca
 * entre sus `children` (los directivas de nivel superior).
 */
export const findAllDirectives = (
  directive: Directive,
  path: string,
): ResultMatchDirectives => {
  const segments = parsePath(path);
  if (segments.length === 0) return new ResultMatchDirectives();

  const [first, ...rest] = segments as [PathSegment, ...PathSegment[]];

  if (matchesSegment(directive, first)) {
    return new ResultMatchDirectives(
      ...(rest.length === 0
        ? [directive]
        : matchChildren(directive.children, rest)),
    );
  }

  return new ResultMatchDirectives(
    ...matchChildren(directive.children, segments),
  );
};

export const findFirstDirective = (
  directive: Directive,
  path: string,
): Directive | undefined => findAllDirectives(directive, path)[0];

const TRAILING_INDEX_RE = /^(.*)\[(\d+)\]$/;

/**
 * Como `findFirstDirective`, pero si la ruta termina en `[N]` con `N` un
 * entero puro (ej. `port[1]`), en vez de la `Directive` "port" devuelve
 * directamente su `args[N-1]` (1-indexado). Es una sintaxis de corchetes
 * distinta de la de `findAll`/`findFirst` (`nombre[valor, ...]`, que
 * filtra por igualdad de `args`): acá un sufijo puramente numérico al
 * final de la ruta significa "extraer el argumento N-ésimo", no filtrar.
 */
export const atDirective = (
  directive: Directive,
  path: string,
): Directive | DirectiveArg | undefined => {
  const match = path.match(TRAILING_INDEX_RE);
  if (!match) return findFirstDirective(directive, path);

  const [, pathWithoutIndex, indexPart] = match;
  const target = findFirstDirective(directive, pathWithoutIndex!);
  return target?.args[Number(indexPart) - 1];
};
