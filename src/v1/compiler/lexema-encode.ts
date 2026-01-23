import { PartSetEncode } from "./part-set-encode.js";
import { PartSet } from "./part-set.js";
import { Token } from "./token.js";
import { Lexema } from "./lexema.js";

export type LexemaEncodeOptions = {
  /**
   * Enable debug info in output
   */
  debug?: boolean;
  allowDebugDocument?: boolean;
};

export class LexemaEncode {
  #storeDocument: boolean;
  #showInvisibleTokens: boolean;

  constructor(options?: LexemaEncodeOptions) {
    this.#storeDocument =
      options?.allowDebugDocument ?? options?.debug ?? false;
    this.#showInvisibleTokens = options?.debug ?? false;
  }

  encode(input: string | Uint8Array | Iterable<number> | PartSet) {
    const partSet: PartSet =
      input instanceof PartSet ? input : new PartSetEncode().encode(input);

    const lexema = new Lexema(
      Token.scan(partSet, { showInvisibleTokens: this.#showInvisibleTokens }),
    );

    if (this.#storeDocument) {
      Lexema.debugSetDocument(lexema, input);
    }

    return lexema;
  }
}
