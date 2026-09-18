// Smoke test: verifies the package's published entry points resolve and
// work on every supported runtime. Run from the repo root, after building
// (`lib/esm` must exist), with either `node` or `bun`:
//
//   node scripts/smoke-test-imports/run.mjs
//   bun scripts/smoke-test-imports/run.mjs
//
// Relies on Node/Bun's package self-reference resolution (a package can
// import its own "exports" by name), so no packing/installing is needed.
//
// Covers every entry point in package.json's "exports": "donly",
// "donly/encoder", "donly/decoder", "donly/load", "donly/lint",
// "donly/find", "donly/demo/http-proxy", and
// "donly/plugins/scoped-variables".

import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  DON,
  Directive,
  DirectiveJSONEncoder,
  DirectiveJSONDecoder,
} from "donly";
import { DirectiveJSONEncoder as EncoderOnly } from "donly/encoder";
import { DirectiveJSONDecoder as DecoderOnly } from "donly/decoder";
import { load } from "donly/load";
// "donly/lint" (the declarative `LintRuleDocument` engine)
import { lintSchema, lint as lintDoc } from "donly/lint";
import { findAllDirectives, findDirective, atDirective } from "donly/find";
import { serve, proxyLintRules } from "donly/demo/http-proxy";
import {
  scopedVariablesPlugin,
  createScopedVariablesPlugin,
} from "donly/plugins/scoped-variables";

// "donly"
const directive = DON.parse('name "example"');
assert.ok(directive instanceof Directive);
assert.equal(directive.name, "name");
assert.deepEqual(directive.args, ["example"]);
assert.equal(typeof DirectiveJSONEncoder.encode, "function");
assert.equal(typeof DirectiveJSONDecoder, "function");

// "donly/encoder"
assert.equal(EncoderOnly, DirectiveJSONEncoder);
const encoded = new EncoderOnly().encode(directive);
assert.deepEqual(encoded, { name: "example" });

// "donly/decoder"
assert.equal(DecoderOnly, DirectiveJSONDecoder);
const decoded = new DecoderOnly().decode(encoded);
assert.ok(decoded instanceof Directive);
assert.equal(decoded.name, "name");
assert.deepEqual(decoded.args, ["example"]);

// "donly/lint"
assert.equal(lintSchema, lintDoc);
assert.equal(typeof lintSchema, "function");
const validIssues = lintSchema("server {\n  port 3000\n}\n", {
  "/server/port": {
    "[1]": { type: "number", message: "port must be a number" },
  },
});
assert.deepEqual(validIssues, []);
const invalidIssues = lintSchema('server {\n  port "3000"\n}\n', {
  "/server/port": {
    "[1]": { type: "number", message: "port must be a number" },
  },
});
assert.equal(invalidIssues.length, 1);
assert.equal(invalidIssues[0].message, "port must be a number");

// "donly/load"
const loadDir = await mkdtemp(join(tmpdir(), "donly-smoke-load-"));
try {
  const loadFilePath = join(loadDir, "file.donly");
  await writeFile(
    loadFilePath,
    'name "my-app"\nserver {\n  host "localhost"\n  port 8080\n}\n',
    "utf8",
  );
  const loaded = await load(loadFilePath);
  assert.deepEqual(loaded, {
    name: "my-app",
    server: { host: "localhost", port: 8080 },
  });
} finally {
  await rm(loadDir, { recursive: true, force: true });
}

// "donly/find"
const proxyDirective = DON.parse(
  "server {\n  route /home\n  route GET /api/user\n}\n",
);
assert.equal(findDirective(proxyDirective, "/server"), proxyDirective);
assert.equal(findAllDirectives(proxyDirective, "/server/route").length, 2);
assert.equal(
  atDirective(proxyDirective, "/server/route(* /api/user)[1]"),
  "GET",
);

// "donly/demo/http-proxy"
assert.equal(typeof serve, "function");
assert.ok(Array.isArray(proxyLintRules));
assert.ok(proxyLintRules.length > 0);

// "donly/plugins/scoped-variables"
assert.equal(typeof createScopedVariablesPlugin, "function");
const scopedResult = DON.parse(
  "set foo 33\n\nfoo $foo\ntar biz {\n  set foo 55\n  foo $foo\n}\n",
  { plugins: [scopedVariablesPlugin] },
);
const [scopedFoo, scopedTar] = scopedResult.children;
assert.deepEqual(scopedFoo.args, [33]);
assert.deepEqual(scopedTar.children[0].args, [55]);

const seededPlugin = createScopedVariablesPlugin({
  variables: { env: "prod" },
});
const seededResult = DON.parse("stage $env", { plugins: [seededPlugin] });
assert.deepEqual(seededResult.args, ["prod"]);

console.log(
  `OK (${globalThis.Bun ? `bun ${Bun.version}` : `node ${process.version}`}): "donly", "donly/encoder", "donly/decoder", "donly/load", "donly/lint", "donly/find", "donly/demo/http-proxy" and "donly/plugins/scoped-variables" all resolve and work.`,
);
