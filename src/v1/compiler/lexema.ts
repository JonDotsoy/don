import type { Token } from "./token.js";
import { PartSet } from "./part-set.js";

export class Lexema {
  static #documents = new WeakMap<
    Lexema,
    string | Uint8Array | Iterable<number> | PartSet
  >();

  constructor(readonly tokens: Token[]) {}

  static debugSetDocument(
    ref: Lexema,
    body: string | Uint8Array | Iterable<number> | PartSet,
  ) {
    this.#documents.set(ref, body);
  }

  static debugGetDocument(ref: Lexema): Uint8Array | null {
    const body = this.#documents.get(ref) ?? null;
    if (!body) return null;
    if (typeof body === "string")
      return new Uint8Array(new TextEncoder().encode(body));
    if (body instanceof Uint8Array) return body;
    if (Symbol.iterator in body) return new Uint8Array(body);
    if (body instanceof PartSet)
      return new Uint8Array(body.parts.map((part) => part.buffer).flat());
    return null;
  }
}
