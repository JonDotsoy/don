import { readFile } from "node:fs/promises";
import { DON } from "./don.js";
import { DirectiveJSONEncoder } from "./directive-json.js";

/**
 * Reads a `.donly` file and parses it into a plain object, nesting each
 * directive's args as keys (`DirectiveJSONEncoder.nestedReducer`).
 */
export const load = async (
  filePath: string | URL,
): Promise<Record<string, unknown>> => {
  const text = await readFile(filePath, "utf8");
  const directive = DON.parse(text);

  return DirectiveJSONEncoder.encode(directive, {
    reducer: DirectiveJSONEncoder.nestedReducer,
  }) as Record<string, unknown>;
};
