// Writes one tiny entry script per published import path ("donly",
// "donly/utils", "donly/encoder", "donly/decoder", "donly/load",
// "donly/lint", "donly/find", "donly/demo/http-proxy",
// "donly/plugins/scoped-variables", "donly/common/errors") into the
// directory given as
// argv[2], plus a manifest.json listing, for each script, the
// `bun build --target <target>` targets it's expected to bundle under
// (node, bun, browser). Each script does a real `import { ... } from
// "<path>"` and touches the imported bindings, so `bun build` has to
// actually resolve and bundle the entry point rather than tree-shake an
// unused import away.
//
// Used by npm-pack-test.sh's "bundle" mode to verify every entry point
// can be bundled against the packed-and-installed tarball, catching
// bundling issues (missing dependencies, unresolvable subpath exports,
// runtime-only builtins bun build can't shim) that plain `node`/`bun`
// execution wouldn't surface.

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const outDir = process.argv[2];
if (!outDir) {
  console.error("Usage: generate-bundle-entries.mjs <out-dir>");
  process.exit(1);
}

const ALL_TARGETS = ["node", "bun", "browser"];

const entries = {
  "donly.mjs": {
    content: `
import { DON, Directive, DirectiveJSONEncoder, DirectiveJSONDecoder } from "donly";
console.log(DON, Directive, DirectiveJSONEncoder, DirectiveJSONDecoder);
`,
    targets: ALL_TARGETS,
  },
  "donly-utils.mjs": {
    content: `
import { inspect } from "donly/utils";
console.log(inspect);
`,
    targets: ALL_TARGETS,
  },
  "donly-encoder.mjs": {
    content: `
import { DirectiveJSONEncoder } from "donly/encoder";
console.log(DirectiveJSONEncoder);
`,
    targets: ALL_TARGETS,
  },
  "donly-decoder.mjs": {
    content: `
import { DirectiveJSONDecoder } from "donly/decoder";
console.log(DirectiveJSONDecoder);
`,
    targets: ALL_TARGETS,
  },
  "donly-load.mjs": {
    content: `
import { load } from "donly/load";
console.log(load);
`,
    targets: ALL_TARGETS,
  },
  "donly-lint.mjs": {
    content: `
import { lintSchema, lint } from "donly/lint";
console.log(lintSchema, lint);
`,
    targets: ALL_TARGETS,
  },
  "donly-find.mjs": {
    content: `
import { findAllDirectives, findDirective, atDirective } from "donly/find";
console.log(findAllDirectives, findDirective, atDirective);
`,
    targets: ALL_TARGETS,
  },
  // Node-only demo (spawns an HTTP(S) server via node:http(s)/node:url),
  // never meant to run in a browser bundle.
  "donly-demo-http-proxy.mjs": {
    content: `
import { serve, proxyLintRules } from "donly/demo/http-proxy";
console.log(serve, proxyLintRules);
`,
    targets: ["node", "bun"],
  },
  "donly-plugins-scoped-variables.mjs": {
    content: `
import { scopedVariablesPlugin, createScopedVariablesPlugin } from "donly/plugins/scoped-variables";
console.log(scopedVariablesPlugin, createScopedVariablesPlugin);
`,
    targets: ALL_TARGETS,
  },
  "donly-common-errors.mjs": {
    content: `
import { DonSyntaxError } from "donly/common/errors";
console.log(DonSyntaxError);
`,
    targets: ALL_TARGETS,
  },
};

await mkdir(outDir, { recursive: true });
const manifest = {};
for (const [fileName, { content, targets }] of Object.entries(entries)) {
  await writeFile(join(outDir, fileName), content.trimStart(), "utf8");
  manifest[fileName] = targets;
}
await writeFile(
  join(outDir, "manifest.json"),
  JSON.stringify(manifest, null, 2),
  "utf8",
);

console.log(
  `Generated ${Object.keys(entries).length} bundle entry scripts in ${outDir}`,
);
