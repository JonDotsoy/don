import { DON, Directive } from "../../src/don.ts";
import type { Formatter } from "./types.ts";

const directiveToJs = (directive: Directive): string => {
  const args = directive.args.map((arg) => JSON.stringify(arg));
  const children = directive.children.length
    ? `[${directive.children.map(directiveToJs).join(", ")}]`
    : "[]";

  return `new Directive(${[JSON.stringify(directive.name), `[${args.join(", ")}]`, children].join(", ")})`;
};

/** Renders each top-level directive as a `new Directive(...)` expression. */
export const jsFormatter: Formatter = (raw) => {
  const directives = DON.parse(raw);
  return directives
    .map((directive) => `${directiveToJs(directive)};`)
    .join("\n");
};

const directiveValue = (directive: Directive): unknown => {
  if (directive.children.length > 0) {
    return directivesToValue(directive.children);
  }

  if (directive.args.length === 0) return true;

  return directive.args.length === 1 ? directive.args[0] : directive.args;
};

const directivesToValue = (
  directives: Directive[],
): Record<string, unknown> => {
  const value: Record<string, unknown> = {};

  for (const directive of directives) {
    const next = directiveValue(directive);

    if (Object.prototype.hasOwnProperty.call(value, directive.name)) {
      const existing = value[directive.name];
      value[directive.name] = Array.isArray(existing)
        ? [...existing, next]
        : [existing, next];
    } else {
      value[directive.name] = next;
    }
  }

  return value;
};

/**
 * Renders the parsed directives as a plain JSON object: a directive with
 * children becomes a nested object, a directive with a single argument
 * becomes a scalar, and repeated directive names collapse into an array.
 */
export const jsonFormatter: Formatter = (raw) => {
  const directives = DON.parse(raw);
  return JSON.stringify(directivesToValue(directives), null, 2);
};

export const defaultFormatters: Record<string, Formatter> = {
  js: jsFormatter,
  json: jsonFormatter,
};
