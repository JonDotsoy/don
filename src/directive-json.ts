import { Directive } from "./don.js";

interface DirectiveJSON {
  name: string;
  args: (number | string | boolean)[];
  children: DirectiveJSON[];
}

const requireStringName = (name: string | symbol): string => {
  if (typeof name !== "string") {
    throw new Error(
      `Invalid directive: name must be a string, got ${String(name)}`,
    );
  }

  return name;
};

const toDirectiveJSON = (directive: Directive): DirectiveJSON => ({
  name: requireStringName(directive.name),
  args: directive.args,
  children: directive.children.map(toDirectiveJSON),
});

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const toDirective = (value: unknown): Directive => {
  if (!isPlainObject(value)) {
    throw new Error(
      `Invalid directive JSON: expected an object, got ${JSON.stringify(value)}`,
    );
  }

  const { name, args, children } = value;

  if (typeof name !== "string") {
    throw new Error(
      `Invalid directive JSON: "name" must be a string, got ${JSON.stringify(name)}`,
    );
  }

  if (
    !Array.isArray(args) ||
    args.some(
      (arg) =>
        typeof arg !== "number" &&
        typeof arg !== "string" &&
        typeof arg !== "boolean",
    )
  ) {
    throw new Error(
      `Invalid directive JSON: "args" must be an array of numbers, strings or booleans, got ${JSON.stringify(args)}`,
    );
  }

  if (!Array.isArray(children)) {
    throw new Error(
      `Invalid directive JSON: "children" must be an array, got ${JSON.stringify(children)}`,
    );
  }

  return new Directive(
    name,
    args as (number | string | boolean)[],
    children.map(toDirective),
  );
};

/**
 * Sentinel used as the synthetic parent of root-level directives, so a
 * reducer's `parent` argument is always a real Directive: check
 * `parent.name === ROOT_DIRECTIVE_NAME` to detect the top level.
 */
export const ROOT_DIRECTIVE_NAME = Symbol("root");

export type DirectiveReducer<T = Record<string, unknown>> = (
  accumulator: T,
  directive: Directive,
  parent: Directive,
) => T;

const reduceChildren = (
  reducer: DirectiveReducer,
  directive: Directive,
): Record<string, unknown> =>
  directive.children.reduce((acc, child) => reducer(acc, child, directive), {});

const assignGrouped = (
  accumulator: Record<string, unknown>,
  directive: Directive,
  parent: Directive,
  value: unknown,
): Record<string, unknown> => {
  const name = requireStringName(directive.name);
  const siblingsWithSameName = parent.children.filter(
    (child) => child.name === directive.name,
  );

  if (siblingsWithSameName.length > 1) {
    const existing = (accumulator[name] as unknown[] | undefined) ?? [];
    accumulator[name] = [...existing, value];
  } else {
    accumulator[name] = value;
  }

  return accumulator;
};

const tupleDirectiveValue = (directive: Directive): unknown => {
  if (directive.children.length === 0) {
    return directive.args.length === 1 ? directive.args[0] : directive.args;
  }

  const childrenValue = reduceChildren(tupleReducer, directive);

  return directive.args.length > 0
    ? [...directive.args, childrenValue]
    : childrenValue;
};

const tupleReducer: DirectiveReducer = (accumulator, directive, parent) =>
  assignGrouped(accumulator, directive, parent, tupleDirectiveValue(directive));

const nestArgs = (
  args: (number | string | boolean)[],
  leaf: unknown,
): unknown => args.reduceRight((acc, arg) => ({ [String(arg)]: acc }), leaf);

const nestedDirectiveValue = (directive: Directive): unknown => {
  const { args, children } = directive;

  if (children.length === 0) {
    if (args.length === 0) return [];
    if (args.length === 1) return args[0];

    return nestArgs(args.slice(0, -1), args[args.length - 1]);
  }

  const childrenValue = reduceChildren(nestedReducer, directive);

  return args.length === 0 ? childrenValue : nestArgs(args, childrenValue);
};

const nestedReducer: DirectiveReducer = (accumulator, directive, parent) =>
  assignGrouped(
    accumulator,
    directive,
    parent,
    nestedDirectiveValue(directive),
  );

const reduceDirectives = (
  directives: Directive[],
  reducer: DirectiveReducer,
): Record<string, unknown> => {
  const root = new Directive(ROOT_DIRECTIVE_NAME, [], directives);
  return directives.reduce(
    (acc, directive) => reducer(acc, directive, root),
    {},
  );
};

/**
 * Reduces a single Directive to the plain JSON value `Directive#toJSON`
 * returns, using the same default (`tupleReducer`) shape as `encode()`.
 */
export const directiveToJSON = (directive: Directive): unknown =>
  reduceDirectives([directive], tupleReducer);

export interface DirectiveJSONEncoderOptions {
  space?: string | number;
  /**
   * Defaults to `tupleReducer`. Pass `null` to get the lossless
   * {name, args, children} array shape instead of a reduced object.
   */
  reducer?: DirectiveReducer | null;
}

export class DirectiveJSONEncoder {
  static readonly tupleReducer = tupleReducer;
  static readonly nestedReducer = nestedReducer;

  encode(
    directives: Directive[],
    options: DirectiveJSONEncoderOptions = {},
  ): string {
    const { space, reducer = tupleReducer } = options;

    const value = reducer
      ? reduceDirectives(directives, reducer)
      : directives.map(toDirectiveJSON);

    return JSON.stringify(value, null, space);
  }

  static encode(
    directives: Directive[],
    options: DirectiveJSONEncoderOptions = {},
  ): string {
    return new DirectiveJSONEncoder().encode(directives, options);
  }
}

const isPrimitive = (value: unknown): value is number | string | boolean =>
  typeof value === "number" ||
  typeof value === "string" ||
  typeof value === "boolean";

const toDirectiveFromReducedEntry = ([name, value]: [
  string,
  unknown,
]): Directive => {
  if (isPlainObject(value)) {
    return new Directive(
      name,
      [],
      Object.entries(value).map(toDirectiveFromReducedEntry),
    );
  }

  if (Array.isArray(value)) {
    if (!value.every(isPrimitive)) {
      throw new Error(
        `Invalid directive JSON: array value for "${name}" must contain only numbers, strings or booleans, got ${JSON.stringify(value)}`,
      );
    }

    return new Directive(name, value, []);
  }

  return new Directive(name, isPrimitive(value) ? [value] : [], []);
};

export class DirectiveJSONDecoder {
  decode(json: string): Directive[] {
    const value = JSON.parse(json);

    if (Array.isArray(value)) {
      return value.map(toDirective);
    }

    if (isPlainObject(value)) {
      const root = new Directive(
        ROOT_DIRECTIVE_NAME,
        [],
        Object.entries(value).map(toDirectiveFromReducedEntry),
      );

      return root.children;
    }

    throw new Error(
      `Invalid directive JSON: expected an array or an object, got ${JSON.stringify(value)}`,
    );
  }
}
