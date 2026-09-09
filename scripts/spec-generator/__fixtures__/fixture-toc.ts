export const status = "Draft";
export const title = "Fixture TOC";
export const description =
  "Exercises tableOfContents() with headings emitted after the call.";
export const lang = "en";

mdLine`# Fixture TOC`;

tableOfContents();

mdLine`## 1. Overview`;

mdLine`Some paragraph.`;

mdLine`## 1.1 DON vs JSON`;
