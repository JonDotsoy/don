export enum SyntaxKind {
  unknown,
  alphabet,
  integer,
  whitespace,
  newline,
  dot,
  underscore,
  singleQuote,
  doubleQuote,
  // {
  openCurlyBrace,
  // }
  closeCurlyBrace,

  ////
  // token types
  ////
  keyword,
  string,
  numeric,
  boolean,
  null,
  comment,
  indent,
  heredoc,
}
