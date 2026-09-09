export const status: "Draft" | "Stable" | "Deprecated" = "Draft";
export const title = "DON Specification v1 - Directive Object Notation";
export const description = `\
Complete specification for DON v1, a human-readable data serialization format designed for configuration files, routers, and security rules. Learn syntax, directives, blocks, and examples.
`;
export const lang = "en";

mdLine`# DON Specification v1`;

mdLine`## 1. Overview`;

mdLine`DON (Directive Object Notation) v1 is a human-readable data serialization format built around directives and subdirectives. This format is designed for configuration files such as security rules, routers, reverse proxies, and similar use cases.`;

mdLine`## 1.1 DON vs JSON`;

mdLine`DON differs fundamentally from JSON in its approach to data representation. While JSON is a key-value structure designed for object serialization, DON uses a directive-based model that more closely resembles program execution with repeated function calls.`;

mdLine`In DON, a declaration like:`;

block({ key: "sample1", lang: "don" })`
name "john"
`;

mdLine`Is conceptually equivalent to a function call in JavaScript:`;

block({ evalBlock: "sample1", format: "js" });

mdLine`Consider a dependencies declaration:`;

block({ key: "sample2", lang: "don" })`
dependencies {
  zod ">=1"
  react ">=5"
}
`;

mdLine`Its equivalent \`Directive\` tree:`;

block({ evalBlock: "sample2", format: "js" });

mdLine`And its JSON equivalent:`;

block({ evalBlock: "sample2", format: "json" });
