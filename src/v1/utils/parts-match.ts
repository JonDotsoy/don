import type { Part } from "../compiler/part.js";
import type { PartSet } from "../compiler/part-set.js";
import type { SyntaxKind } from "./syntax-kind.js";

type A<T extends string, V> = Record<T, { eq: V }>;

type expressions =
  | A<"type", SyntaxKind>
  | A<"buffer", number[]>
  | A<"type" | "buffer", SyntaxKind>;

export const partsMatch = (
  parts: PartSet | { parts: Part[] },
  expressions: expressions[],
): boolean => {
  if (parts.parts.length !== expressions.length) {
    return false;
  }

  for (let i = 0; i < expressions.length; i++) {
    const part = parts.parts[i];
    const expr = expressions[i];

    if (!part || !expr) {
      return false;
    }

    if ("type" in expr && expr.type) {
      if (part.type !== expr.type.eq) {
        return false;
      }
    }

    if ("buffer" in expr && expr.buffer && Array.isArray(expr.buffer.eq)) {
      const expectedBuffer = expr.buffer.eq;
      if (part.buffer.length !== expectedBuffer.length) {
        return false;
      }
      for (let j = 0; j < expectedBuffer.length; j++) {
        if (part.buffer[j] !== expectedBuffer[j]) {
          return false;
        }
      }
    }
  }

  return true;
};
