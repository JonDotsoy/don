/**
 * Raised for malformed DON source text — anything the lexer or syntax
 * parser rejects (an unterminated string, an unterminated block, tokens
 * after a block close, ...). Callers can check `error instanceof
 * DonSyntaxError` to distinguish a DON parsing failure from any other
 * error a call into this library might throw.
 */
export class DonSyntaxError extends SyntaxError {
  constructor(message: string) {
    super(message);
    this.name = "DonSyntaxError";
  }
}
