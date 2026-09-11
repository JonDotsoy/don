// Type-only smoke test: checked with `tsc -p tsconfig.json` in this
// directory (see tsconfig.json). It is never executed — the goal is to
// confirm each public export's TypeScript signature accepts the
// documented argument types and produces the documented result types,
// for every published entry point ("donly", "donly/encoder",
// "donly/decoder"). Relies on the same self-reference resolution the
// runtime smoke test (run.mjs) uses, so `lib/esm` must be built first.

import {
  DON,
  Directive,
  DirectiveJSONEncoder,
  DirectiveJSONDecoder,
  HeredocValue,
} from "donly";
import type { DirectiveReducer, DirectiveJSONEncoderOptions } from "donly";
import { DirectiveJSONEncoder as EncoderOnly } from "donly/encoder";
import { DirectiveJSONDecoder as DecoderOnly } from "donly/decoder";

// --- "donly": DON.parse ---

const parseFn: (text: string) => Directive[] = DON.parse;
const parsed: Directive[] = DON.parse("name value");

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
const heredocType: string = heredoc.type;
const heredocContent: string = heredoc.content;

// --- "donly": DirectiveJSONEncoder (static + instance) ---

const staticJson: string = DirectiveJSONEncoder.encode(parsed);
const staticJsonWithOptions: string = DirectiveJSONEncoder.encode(parsed, {
  space: 2,
  reducer: DirectiveJSONEncoder.tupleReducer,
});
const staticJsonRawShape: string = DirectiveJSONEncoder.encode(parsed, {
  reducer: null,
});
const instanceJson: string = new DirectiveJSONEncoder().encode(parsed);

const tupleReducer: DirectiveReducer = DirectiveJSONEncoder.tupleReducer;
const nestedReducer: DirectiveReducer = DirectiveJSONEncoder.nestedReducer;
const customReducer: DirectiveReducer = (accumulator, current, parent) => {
  const _name: string | symbol = current.name;
  const _parent: Directive = parent;
  return accumulator;
};

const encoderOptions: DirectiveJSONEncoderOptions = {
  space: "  ",
  reducer: nestedReducer,
};

// --- "donly": DirectiveJSONDecoder (instance-only) ---

const decoded: Directive[] = new DirectiveJSONDecoder().decode(staticJson);

// --- "donly/encoder" and "donly/decoder" re-export the same classes ---

const encoderSame: boolean = EncoderOnly === DirectiveJSONEncoder;
const decoderSame: boolean = DecoderOnly === DirectiveJSONDecoder;
const encodedViaSubpath: string = new EncoderOnly().encode(parsed);
const decodedViaSubpath: Directive[] = new DecoderOnly().decode(
  encodedViaSubpath,
);

// --- negative cases: unsupported argument/result types must not compile ---

// @ts-expect-error DON.parse requires a string
DON.parse(123);

// @ts-expect-error encode's first argument must be Directive[]
DirectiveJSONEncoder.encode("nope");

// @ts-expect-error Directive args must be number | string | boolean
new Directive("name", [{ bad: true }]);

// @ts-expect-error the reducer option must be a function, null, or omitted
DirectiveJSONEncoder.encode(parsed, { reducer: "nope" });

// @ts-expect-error decode requires a string
new DirectiveJSONDecoder().decode(123);

// Silence unused-variable noise from the assertions above; nothing here runs.
void [
  parseFn,
  directiveNoChildren,
  directiveName,
  directiveArgs,
  directiveChildren,
  directiveJSON,
  directiveWithHeredoc,
  heredocType,
  heredocContent,
  staticJsonWithOptions,
  staticJsonRawShape,
  instanceJson,
  tupleReducer,
  customReducer,
  encoderOptions,
  decoded,
  encoderSame,
  decoderSame,
  decodedViaSubpath,
];
