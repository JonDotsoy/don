// Writes one tiny entry script per published import path ("donly",
// "donly/encoder", "donly/decoder", "donly/load", "donly/lint",
// "donly/find", "donly/demo/http-proxy") into the directory given as
// argv[2]. Each script does a real `import { ... } from "<path>"` and
// touches the imported bindings, so `bun build` has to actually resolve
// and bundle the entry point rather than tree-shake an unused import away.
//
// Used by npm-pack-test.sh's "bundle" mode to verify every entry point
// can be bundled with `bun build --target node <script>` against the
// packed-and-installed tarball, catching bundling issues (missing
// dependencies, unresolvable subpath exports, Node-only builtins bun
// build can't shim) that plain `node`/`bun` execution wouldn't surface.

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const outDir = process.argv[2];
if (!outDir) {
  console.error("Usage: generate-bundle-entries.mjs <out-dir>");
  process.exit(1);
}

const entries = {
  "donly.mjs": `
import { DON, Directive, DirectiveJSONEncoder, DirectiveJSONDecoder } from "donly";
console.log(DON, Directive, DirectiveJSONEncoder, DirectiveJSONDecoder);
`,
  "donly-encoder.mjs": `
import { DirectiveJSONEncoder } from "donly/encoder";
console.log(DirectiveJSONEncoder);
`,
  "donly-decoder.mjs": `
import { DirectiveJSONDecoder } from "donly/decoder";
console.log(DirectiveJSONDecoder);
`,
  "donly-load.mjs": `
import { load } from "donly/load";
console.log(load);
`,
  "donly-lint.mjs": `
import { lintSchema, lint } from "donly/lint";
console.log(lintSchema, lint);
`,
  "donly-find.mjs": `
import { findAllDirectives, findDirective, atDirective } from "donly/find";
console.log(findAllDirectives, findDirective, atDirective);
`,
  "donly-demo-http-proxy.mjs": `
import { serve, proxyLintRules } from "donly/demo/http-proxy";
console.log(serve, proxyLintRules);
`,
};

await mkdir(outDir, { recursive: true });
for (const [fileName, content] of Object.entries(entries)) {
  await writeFile(join(outDir, fileName), content.trimStart(), "utf8");
}

console.log(
  `Generated ${Object.keys(entries).length} bundle entry scripts in ${outDir}`,
);
