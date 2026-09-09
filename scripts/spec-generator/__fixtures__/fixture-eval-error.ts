export const status = "Draft";
export const title = "Fixture Eval Error";
export const description =
  "Exercises evalBlock referencing a key that was never registered.";
export const lang = "en";

mdLine`# Fixture Eval Error`;

block({ evalBlock: "never-registered", format: "js" });
