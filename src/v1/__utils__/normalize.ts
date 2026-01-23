import type { u8 } from "../types/u8.js";

export const normalize = (input: string | Uint8Array | number[]): u8 => {
  if (typeof input === "string") return [...new TextEncoder().encode(input)];
  if (input instanceof Uint8Array) return [...input];
  if (Array.isArray(input) && input.every((value) => typeof value === "number"))
    return input;
  throw new Error("not implemented");
};
