export const status = "Draft";
export const title = "Fixture Spec";
export const description = "A minimal fixture used to test the spec generator.";
export const lang = "en";

mdLine`# Fixture Spec`;

mdLine`Some intro paragraph.`;

block({ key: "sample", lang: "don" })`
name "john"
`;

block({ evalBlock: "sample", format: "js" });
