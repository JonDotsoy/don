import { Part } from "./part.js";
import { PartSet } from "./part-set.js";

export class PartSetEncode {
  constructor() {}

  encode(input: string | Uint8Array | Iterable<number>) {
    const buff =
      typeof input === "string"
        ? new TextEncoder().encode(input)
        : input instanceof Uint8Array
          ? input
          : new Uint8Array(input);

    const parts = Part.scan([...buff]);

    return new PartSet(parts);
  }
}
