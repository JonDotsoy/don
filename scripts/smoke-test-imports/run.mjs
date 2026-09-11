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
assert.equal(decoded.length, 1);
assert.ok(decoded[0] instanceof Directive);
assert.equal(decoded[0].name, "name");
assert.deepEqual(decoded[0].args, ["example"]);

console.log(
  `OK (${globalThis.Bun ? `bun ${Bun.version}` : `node ${process.version}`}): "donly", "donly/encoder" and "donly/decoder" all resolve and work.`,
);
