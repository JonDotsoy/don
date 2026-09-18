// Type-only smoke test: checked with `tsc -p tsconfig.json` in this
// directory (see tsconfig.json). It is never executed — the goal is to
// confirm each public export's TypeScript signature accepts the
// documented argument types and produces the documented result types,
// for every published entry point ("donly", "donly/encoder",
// "donly/decoder", "donly/load", "donly/lint", "donly/find",
// "donly/demo/http-proxy", "donly/plugins/scoped-variables"). Relies on
// the same self-reference resolution the runtime smoke test (run.mjs)
// uses, so `lib/esm` must be built first.

import {
  DON,
  Directive,
  DirectiveJSONEncoder,
  DirectiveJSONDecoder,
  HeredocValue,
} from "donly";
import type {
  DirectiveReducer,
  DirectiveJSONEncoderOptions,
  DonPlugin,
} from "donly";
import { DirectiveJSONEncoder as EncoderOnly } from "donly/encoder";
import { DirectiveJSONDecoder as DecoderOnly } from "donly/decoder";
import { load } from "donly/load";
import { lintSchema, lint as lintDoc } from "donly/lint";
import type { LintRuleDocument, LintIssue } from "donly/lint";
import { findAllDirectives, findDirective, atDirective } from "donly/find";
import { serve, proxyLintRules } from "donly/demo/http-proxy";
import type {
  ServerConfig,
  RouteConfig,
  HeaderRule,
} from "donly/demo/http-proxy";
import {
  scopedVariablesPlugin,
  createScopedVariablesPlugin,
} from "donly/plugins/scoped-variables";
import type { ScopedVariablesPluginOptions } from "donly/plugins/scoped-variables";

// --- "donly": DON.parse ---

const parseFn: (text: string) => Directive = DON.parse;
const parsed: Directive = DON.parse("name value");

// --- "donly": Directive ---

const directive: Directive = new Directive("name", ["value", 1, true], []);
const directiveNoChildren: Directive = new Directive("name", []);
const directiveName: string | symbol = directive.name;
const directiveArgs: (number | string | boolean | HeredocValue)[] =
  directive.args;
const directiveChildren: Directive[] = directive.children;
const directiveJSON: unknown = directive.toJSON();

// --- "donly": HeredocValue ---

const heredoc: HeredocValue = new HeredocValue("HTML", "<div></div>\n");
const directiveWithHeredoc: Directive = new Directive("name", [heredoc]);
const heredocDelimiter: string | null = heredoc.delimiter;
const heredocContent: string = heredoc.content;

// --- "donly": DirectiveJSONEncoder (static + instance) ---

const staticValue: unknown = DirectiveJSONEncoder.encode(parsed);
const staticValueFromArray: unknown = DirectiveJSONEncoder.encode([parsed]);
const staticValueWithOptions: unknown = DirectiveJSONEncoder.encode(parsed, {
  reducer: DirectiveJSONEncoder.tupleReducer,
});
const staticValueRawShape: unknown = DirectiveJSONEncoder.encode(parsed, {
  reducer: null,
});
const instanceValue: unknown = new DirectiveJSONEncoder().encode(parsed);

const tupleReducer: DirectiveReducer = DirectiveJSONEncoder.tupleReducer;
const nestedReducer: DirectiveReducer = DirectiveJSONEncoder.nestedReducer;
const customReducer: DirectiveReducer = (accumulator, current, parent) => {
  const _name: string | symbol = current.name;
  const _parent: Directive = parent;
  return accumulator;
};

const encoderOptions: DirectiveJSONEncoderOptions = {
  reducer: nestedReducer,
};

// --- "donly": DirectiveJSONDecoder (instance-only) ---

const decoded: Directive = new DirectiveJSONDecoder().decode(staticValue);

// --- "donly/encoder" and "donly/decoder" re-export the same classes ---

const encoderSame: boolean = EncoderOnly === DirectiveJSONEncoder;
const decoderSame: boolean = DecoderOnly === DirectiveJSONDecoder;
const encodedViaSubpath: unknown = new EncoderOnly().encode(parsed);
const decodedViaSubpath: Directive = new DecoderOnly().decode(
  encodedViaSubpath,
);

// --- "donly/lint": lintSchema/lint (declarative LintRuleDocument engine) ---

const lintSchemaSame: boolean = lintSchema === lintDoc;
const ruleDocument: LintRuleDocument = {
  "/server/port": {
    "[1]": { type: "number", message: "port debe ser un número" },
  },
};
const lintDocIssues: LintIssue[] = lintSchema(
  "server { port 3000 }",
  ruleDocument,
);

// --- "donly/load": load ---

const loadFn: (filePath: string | URL) => Promise<Record<string, unknown>> =
  load;
const loadedPromise: Promise<Record<string, unknown>> = load("./file.donly");

// --- "donly/find": findAllDirectives, findDirective, atDirective ---

const foundAll: Directive[] = findAllDirectives(parsed, "/server/route");
const foundOne: Directive | undefined = findDirective(parsed, "/server/route");
const foundArg: string | number | boolean | HeredocValue | undefined =
  atDirective(parsed, "/server/route(/home)[1]");
const foundDirectiveAt: Directive | undefined = atDirective(
  parsed,
  "/server/route(/home)",
);

// --- "donly/demo/http-proxy": serve, proxyLintRules ---

const serveFn: (patch: string | URL) => Promise<{ stop(): Promise<void> }> =
  serve;
const rulesLength: number = proxyLintRules.length;
const serverConfig: ServerConfig = {
  host: "0.0.0.0",
  port: 8080,
  http1: true,
  http2: false,
  http3: false,
  ssl: null,
  headers: [],
  routes: [],
};
const routeConfig: RouteConfig = {
  method: null,
  path: "/",
  action: { kind: "respond", status: 200, body: "OK" },
  headers: [],
};
const headerRule: HeaderRule = { name: "X", value: "Y" };

// --- "donly/plugins/scoped-variables": scopedVariablesPlugin, createScopedVariablesPlugin ---

const scopedPlugin: DonPlugin = scopedVariablesPlugin;
const scopedOptions: ScopedVariablesPluginOptions = {
  variables: { env: "prod", replicas: 3 },
};
const scopedOptionsFromMap: ScopedVariablesPluginOptions = {
  variables: new Map([["env", "staging"]]),
};
const seededPlugin: DonPlugin = createScopedVariablesPlugin(scopedOptions);
const seededPluginNoOptions: DonPlugin = createScopedVariablesPlugin();
const scopedParsed: Directive = DON.parse("stage $env", {
  plugins: [seededPlugin],
});

// --- negative cases: unsupported argument/result types must not compile ---

// @ts-expect-error DON.parse requires a string
DON.parse(123);

// @ts-expect-error encode's first argument must be Directive or Directive[]
DirectiveJSONEncoder.encode("nope");

// @ts-expect-error Directive args must be number | string | boolean
new Directive("name", [{ bad: true }]);

// @ts-expect-error the reducer option must be a function, null, or omitted
DirectiveJSONEncoder.encode(parsed, { reducer: "nope" });

// Silence unused-variable noise from the assertions above; nothing here runs.
void [
  parseFn,
  directiveNoChildren,
  directiveName,
  directiveArgs,
  directiveChildren,
  directiveJSON,
  directiveWithHeredoc,
  heredocDelimiter,
  heredocContent,
  staticValueFromArray,
  staticValueWithOptions,
  staticValueRawShape,
  instanceValue,
  tupleReducer,
  customReducer,
  encoderOptions,
  decoded,
  encoderSame,
  decoderSame,
  decodedViaSubpath,
  lintSchemaSame,
  lintDocIssues,
  loadFn,
  loadedPromise,
  foundAll,
  foundOne,
  foundArg,
  foundDirectiveAt,
  serveFn,
  rulesLength,
  serverConfig,
  routeConfig,
  headerRule,
  scopedPlugin,
  scopedOptionsFromMap,
  seededPluginNoOptions,
  scopedParsed,
];
