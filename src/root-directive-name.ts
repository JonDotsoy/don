/**
 * Sentinel used as the name of a synthetic root Directive — either the
 * parent of root-level directives during JSON reduction/decoding, or the
 * wrapper DON.parse() returns when parsing text with multiple top-level
 * directives. Check `directive.name === ROOT_DIRECTIVE_NAME` to detect it.
 */
export const ROOT_DIRECTIVE_NAME = Symbol("root");
