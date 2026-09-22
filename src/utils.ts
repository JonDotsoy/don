import { DirectiveJSONEncoder } from "./directive-json.js";
import type { Directive } from "./don.js";

/**
 * The shapes the `donly inspect` CLI command can encode a Directive to:
 * `nested` groups a directive's args into nested objects keyed by each
 * arg's value (the default); `tuple` groups by a directive's first arg
 * only; `raw` skips reducing entirely, returning the lossless
 * `{name, args, children}` array shape.
 */
export type InspectStrategy = "nested" | "tuple" | "raw";

/**
 * Encodes a Directive (or Directives) to a plain JSON value using one of
 * `InspectStrategy`'s shapes. Backs the `donly inspect` CLI command.
 */
export const inspect = (
  directive: Directive | Directive[],
  strategy: InspectStrategy = "nested",
): unknown => {
  const reducer =
    strategy === "nested"
      ? DirectiveJSONEncoder.nestedReducer
      : strategy === "tuple"
        ? DirectiveJSONEncoder.tupleReducer
        : null;

  return new DirectiveJSONEncoder().encode(directive, { reducer });
};
