import { PartialSpan } from "../compiler/partial-span.js";
import { Span } from "../compiler/span.js";
import type { u8 } from "../types/u8.js";

export class Charset {
  #length: number;

  constructor(private readonly charset: u8) {
    this.#length = charset.length;
  }

  get length() {
    return this.#length;
  }

  slice(start: number, end: number) {
    return this.charset.slice(start, end);
  }

  /**
   * Finds a continuous span of characters from the charset that match the whitelist.
   * Returns a Span object representing the position and length of the matched sequence.
   *
   * @param {u8} whitelist - Array of allowed character codes to match
   * @param {number} [fromIndex=0] - The index to start searching from (defaults to 0)
   * @returns {Span | null} A Span object with the start position and length of the match,
   *   or null if no characters from the whitelist are found at the starting position
   *
   * @example
   * ```ts
   * const charset = new Charset([65, 66, 67, 68]); // "ABCD"
   * const span = charset.span([65, 66]); // Match 'A' and 'B'
   * // Returns: Span { start: 0, length: 2 }
   * ```
   *
   * @example
   * ```ts
   * const charset = new Charset([32, 32, 65, 66]); // "  AB"
   * const span = charset.span([32], 0); // Match spaces
   * // Returns: Span { start: 0, length: 2 }
   * ```
   */
  span(
    whitelist: u8,
    fromIndex: number = 0,
    limit: null | number = null,
  ): PartialSpan | null {
    let matchedPos: null | number = null;
    let whitelistSet = new Set(whitelist);

    for (
      let i = fromIndex, char = this.charset[i];
      char && i < this.charset.length && whitelistSet.has(char);
      i++, char = this.charset[i]
    ) {
      matchedPos = i;
      const length = matchedPos - fromIndex + 1;
      if (limit !== null && length >= limit) break;
    }

    if (matchedPos === null) return null;

    return new PartialSpan(fromIndex, matchedPos - fromIndex + 1);
  }
}
