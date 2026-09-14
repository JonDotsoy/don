// Smoke test: verifies the package's published entry points resolve and
// work on every supported runtime. Run from the repo root, after building
// (`lib/esm` must exist), with either `node` or `bun`:
//
//   node scripts/smoke-test-imports/run.mjs
//   bun scripts/smoke-test-imports/run.mjs
//
// Relies on Node/Bun's package self-reference resolution (a package can
// import its own "exports" by name), so no packing/installing is needed.

import assert from "node:assert/strict";
import {
  DON,
  Directive,
  DirectiveJSONEncoder,
  DirectiveJSONDecoder,
} from "donly";
import { DirectiveJSONEncoder as EncoderOnly } from "donly/encoder";
import { DirectiveJSONDecoder as DecoderOnly } from "donly/decoder";
// "donly/lint" (the declarative `LintRuleDocument` engine)
import { lintSchema, lint as lintDoc } from "donly/lint";

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

console.log(
  `OK (${globalThis.Bun ? `bun ${Bun.version}` : `node ${process.version}`}): "donly", "donly/encoder", "donly/decoder" and "donly/lint" all resolve and work.`,
);
