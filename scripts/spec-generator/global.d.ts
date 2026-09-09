import type { Block, MdLine } from "./types.ts";

// `_generator_specs.ts` files call `mdLine` and `block` without importing
// them — `compileSpec` injects the real implementations as globals for the
// duration of the import. This ambient declaration only provides types.
declare global {
  const mdLine: MdLine;
  const block: Block;
}

export {};
