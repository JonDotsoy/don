import { describe, expect, test } from "bun:test"
import { SyntaxKind } from "./utils/syntax-kind.js";
import { PartSetEncode } from "./compiler/part-set-encode.js";
import { LexerParser } from "./compiler/lexema-encode.js";
import "./__utils__/to-token-snapshot.js";
import { takeWhile } from "./utils/take-while.js";
import { partsMatch } from "./utils/parts-match.js";
import { SyntaxParser } from "./compiler/syntax-encode.js";

describe("PartSetEncode", () => {
  const partSetEncode = (snapshotName: string, value: string) => () => {
    const partSet = new PartSetEncode().encode(value)
    expect(partSet).toTokenSnapshot(snapshotName);
  }

  test("should encode simple alphabetic identifier",
    partSetEncode("simple-identifier", "asd")
  )

  test("should encode unknown character with unknown syntax kind",
    partSetEncode("unknown-character", "/")
  )

  test("should encode multiple identifiers separated by whitespace",
    partSetEncode("identifiers-with-whitespace", "abc asd")
  )

  test("should encode identifiers with whitespace and newline",
    partSetEncode("identifiers-whitespace-newline", "abc asd\n")
  )

  test("should encode decimal number",
    partSetEncode("decimal-number", "12.123")
  );

  test("should encode number inside curly braces",
    partSetEncode("number-in-curly-braces", "{12.123}")
  );

  test("should encode identifier and number inside curly braces",
    partSetEncode("identifier-number-in-curly-braces", "foo {12.123}")
  );

  test("should encode identifier with trailing whitespace",
    partSetEncode("identifier-trailing-whitespace", "foo ")
  );

  test("should encode identifier with leading whitespace",
    partSetEncode("identifier-leading-whitespace", " foo")
  );
});

describe("LexemaEncode", () => {
  test("should encode alphabetic keyword", () => {
    const lexema = new LexerParser({ debug: true }).parse("foo");

    expect(lexema).toTokenSnapshot("simple-alphabetic-keyword");
  });

  test("should encode alphanumeric keyword", () => {
    const lexema = new LexerParser({ debug: true }).parse("foo123");

    expect(lexema).toTokenSnapshot("alphanumeric-keyword");
  });

  test("should encode keyword and number as separate tokens", () => {
    const lexema = new LexerParser({ debug: true }).parse("foo 123");

    expect(lexema).toTokenSnapshot("keyword-whitespace-number");
  });

  test("should encode special characters and negative numbers", () => {
    const lexema = new LexerParser({ debug: true }).parse("$foo -123");

    expect(lexema).toTokenSnapshot("special-chars-and-negative-numbers");
  });

  test("should encode identifier with nested identifier in curly braces", () => {
    const lexema = new LexerParser({ debug: true }).parse("foo { tar }");

    expect(lexema).toTokenSnapshot("foo-curly-braces-tar");
  });

  test("should encode nested curly braces with route directives", () => {
    const lexema = new LexerParser({ allowDebugDocument: true }).parse(
      ''
      + 'example.com {\n'
      + '  route /profile/* {\n'
      + '    respond 200 "Ok"\n'
      + '  }\n'
      + '}'
    );

    expect(lexema).toTokenSnapshot("nested-curly-braces-route");
  });

  test("should encode multiple consecutive newlines", () => {
    const lexema = new LexerParser({ debug: true }).parse("\n\n\n\n");

    expect(lexema).toTokenSnapshot("multiple-newlines");
  });

  test("should encode different number formats", () => {
    const lexema = new LexerParser({ allowDebugDocument: true }).parse(
      '123 123.312 -123 -123.123 123n'
    );

    expect(lexema).toTokenSnapshot("number-formats");
  });

  test("should encode boolean values", () => {
    const lexema = new LexerParser({ allowDebugDocument: true }).parse(
      'true false'
    );

    expect(lexema).toTokenSnapshot("boolean-values");
  });

  test("should encode null value", () => {
    const lexema = new LexerParser({ allowDebugDocument: true }).parse('null');

    expect(lexema).toTokenSnapshot("null-value");
  });

  test("should encode identifiers on separate lines", () => {
    const lexema = new LexerParser({ allowDebugDocument: true }).parse('foo\ntaz');

    expect(lexema).toTokenSnapshot("identifiers-with-newline");
  });

  test("should encode alphanumeric identifiers on separate lines", () => {
    const lexema = new LexerParser({ allowDebugDocument: true }).parse('foo123\ntaz');

    expect(lexema).toTokenSnapshot("alphanumeric-identifiers-with-newline");
  });

  test("should encode identifier followed by open curly brace", () => {
    const lexema = new LexerParser({ allowDebugDocument: true }).parse('foo{');

    expect(lexema).toTokenSnapshot("identifier-open-curly-brace");
  });

  test("should encode alphanumeric identifier followed by close curly brace", () => {
    const lexema = new LexerParser({ allowDebugDocument: true }).parse('foo123}');

    expect(lexema).toTokenSnapshot("alphanumeric-identifier-close-curly-brace");
  });

  test("should encode complex directive with special characters and nested braces", () => {
    const lexema = new LexerParser({ allowDebugDocument: true, debug: true }).parse(
      ''
      + 'directive $blis _lol path/${name} {\n'
      + '  directive abc\n'
      + '}'
    );

    expect(lexema).toTokenSnapshot("complex-directive-with-nested-braces");
  });

  test("should encode identifier with leading whitespace", () => {
    const lexema = new LexerParser({ debug: true }).parse("  foo");

    expect(lexema).toTokenSnapshot("leading-whitespace-identifier");
  });

  test("should encode heredoc with HTML content", () => {
    const lexema = new LexerParser({ allowDebugDocument: true }).parse(
      ''
      + 'foo <<<HTML\n'
      + '  <div> foo </div>'
    );

    expect(lexema).toTokenSnapshot("heredoc-html-simple");
  });

  test("should encode heredoc followed by another directive", () => {
    const lexema = new LexerParser({ allowDebugDocument: true }).parse(
      ''
      + 'foo <<<HTML\n'
      + '  <div>foo</div>\n'
      + 'tar\n'
    );

    expect(lexema).toTokenSnapshot("heredoc-html-with-trailing-identifier");
  });

  test("should encode heredoc with HTML content inside curly braces", () => {
    const lexema = new LexerParser({ allowDebugDocument: true, debug: true }).parse(
      ''
      + 'biz {\n'
      + '  foo <<<HTML\n'
      + '    <div>foo</div>\n'
      + '  tar\n'
      + '}\n'
    );

    expect(lexema).toTokenSnapshot("heredoc-html-in-curly-braces");
  });

  test("should encode heredoc without closing delimiter inside curly braces", () => {
    const lexema = new LexerParser({ allowDebugDocument: true, debug: true }).parse(
      ''
      + 'biz {\n'
      + '  foo <<<HTML\n'
      + '  div foo\n'
      + '  tar\n'
      + '}\n'
    );

    expect(lexema).toTokenSnapshot("heredoc-without-closing-delimiter");
  });

  test("should encode double-quoted string with space", () => {
    const lexema = new LexerParser({ allowDebugDocument: true }).parse('"foo biz"');

    expect(lexema).toTokenSnapshot("double-quoted-string-with-space");
  });

  test("should encode double-quoted string with escaped quote", () => {
    const lexema = new LexerParser({ allowDebugDocument: true }).parse('"tar\\""');

    expect(lexema).toTokenSnapshot("double-quoted-string-with-escaped-quote");
  });

  test("should encode single-quoted string with space", () => {
    const lexema = new LexerParser({ allowDebugDocument: true }).parse("'foo biz'");

    expect(lexema).toTokenSnapshot("single-quoted-string-with-space");
  });

  test("should encode single-quoted string with escaped quote", () => {
    const lexema = new LexerParser({ allowDebugDocument: true }).parse("'foo \\'biz'");

    expect(lexema).toTokenSnapshot("single-quoted-string-with-escaped-quote");
  });

  test("should encode identifier with double-quoted string containing escaped quote and trailing identifier", () => {
    const lexema = new LexerParser({ allowDebugDocument: true }).parse('fod "foo\\"tar" biz');

    expect(lexema).toTokenSnapshot("identifier-double-quoted-escaped-identifier");
  });

  test("should encode identifier with single-quoted string containing escaped quote and trailing identifier", () => {
    const lexema = new LexerParser({ allowDebugDocument: true }).parse("fod 'foo\\'tar' biz");

    expect(lexema).toTokenSnapshot("identifier-single-quoted-escaped-identifier");
  });

  test("should encode identifier with double-quoted string containing escaped quote with spaces and trailing identifier", () => {
    const lexema = new LexerParser({ allowDebugDocument: true }).parse('fod "foo \\" tar" biz');

    expect(lexema).toTokenSnapshot("identifier-double-quoted-escaped-with-spaces-identifier");
  });

  test("should encode identifier with single-quoted string containing escaped quote with spaces and trailing identifier", () => {
    const lexema = new LexerParser({ allowDebugDocument: true }).parse("fod 'foo \\' tar' biz");

    expect(lexema).toTokenSnapshot("identifier-single-quoted-escaped-with-spaces-identifier");
  });

  test("should encode identifier with single-quoted multiline string containing escaped quote and trailing identifier", () => {
    const lexema = new LexerParser({ allowDebugDocument: true }).parse(
      ''
      + `fod 'foo\n`
      + ` \\' \n`
      + ` tar' biz`
    );

    expect(lexema).toTokenSnapshot("identifier-single-quoted-multiline-escaped-identifier");
  });

  test("should encode identifier with single-quoted string containing heredoc syntax and trailing identifier", () => {
    const lexema = new LexerParser({ allowDebugDocument: true }).parse("fod 'foo <<<TAR\n tar' biz");

    expect(lexema).toTokenSnapshot("identifier-single-quoted-with-heredoc-syntax-identifier");
  });
});

test("should take elements while predicate is true", () => {
  expect([...takeWhile([1, 2, 3], v => v !== 3)]).toEqual([1, 2]);
  expect([...takeWhile([1, 2, 3, 4], v => v !== 3)]).toEqual([1, 2]);
  expect([...takeWhile([1, 2, 3, 4], v => v !== 3, 1)]).toEqual([2]);
});

describe("partsMatch", () => {
  const t = (value: string) => new PartSetEncode().encode(value);

  test("should match negative number pattern", () => {
    const parts = t('-123')
    expect(partsMatch(parts, [{ buffer: { eq: [45] } }, { type: { eq: SyntaxKind.integer } }])).toBeTrue();
  })
  test("should match positive integer pattern", () => {
    const parts = t('123')
    expect(partsMatch(parts, [{ type: { eq: SyntaxKind.integer } }])).toBeTrue();
  })
  test("should match decimal number pattern", () => {
    const parts = t('123.123')
    expect(partsMatch(parts, [
      { type: { eq: SyntaxKind.integer } },
      { type: { eq: SyntaxKind.dot } },
      { type: { eq: SyntaxKind.integer } },
    ])).toBeTrue();
  })
  test("should match bigint pattern", () => {
    expect(partsMatch(t('123n'), [
      { type: { eq: SyntaxKind.integer } },
      { type: { eq: SyntaxKind.alphabet }, buffer: { eq: [110] } },
    ])).toBeTrue();
  })
  test("should not match invalid bigint with trailing digits", () => {
    expect(partsMatch(t('123n1'), [
      { type: { eq: SyntaxKind.integer } },
      { type: { eq: SyntaxKind.alphabet }, buffer: { eq: [110] } },
    ])).not.toBeTrue();
  })
})

describe("SyntaxEncode", () => {
  const snapSyntax = (snapshot: string, payload: string) => () => {
    expect(new LexerParser({ allowDebugDocument: true }).parse(payload)).toTokenSnapshot(`${snapshot}-lexema`);
    expect(new SyntaxParser().parse(payload)).toTokenSnapshot(`${snapshot}-syntax`);
  }

  test("should encode nested directives with curly braces", snapSyntax("nested-directives-with-curly-braces",
    ''
    + 'directive foo {\n'
    + '  directive2 taz lip {\n'
    + '    directive4\n'
    + '  }\n'
    + '  directive3 bob\n'
    + '}\n'
    + 'bliz tar\n'
  ));

  test("should encode router configuration with reverse proxy", snapSyntax("router-reverse-proxy-config",
    ''
    + 'example.com {\n'
    + '  reverse_proxy 127.0.0.1:3000\n'
    + '  tls admin@example.com\n'
    + '  acme_dns cloudflare\n'
    + '  log {\n'
    + '    output file /var/log/caddy/access.log\n'
    + '    format json\n'
    + '  }\n'
    + '}\n'
  ));

  test("should encode container deployment with pod and service", snapSyntax("container-deployment-pod-service",
    ''
    + 'pod nginx {\n'
    + '  container nginx {\n'
    + '    image nginx:stable\n'
    + '    port http-web-svc 80\n'
    + '  }\n'
    + '}\n'
    + '\n'
    + 'service nginx-service {\n'
    + '  selector nginx\n'
    + '  port http-web-svc 80 TCP\n'
    + '}\n'
  ));

  test("should encode CI pipeline with heredoc steps", snapSyntax("ci-pipeline-heredoc-steps",
    ''
    + 'name "Node.js CI"\n'
    + '\n'
    + 'on push\n'
    + '\n'
    + 'job build {\n'
    + '  runs-on ubuntu-latest\n'
    + '\n'
    + '  step <<<\n'
    + '    npm ci\n'
    + '\n'
    + '  step <<<\n'
    + '    npm run build --if-present\n'
    + '\n'
    + '  step <<<\n'
    + '    npm test\n'
    + '}\n'
  ));
});
