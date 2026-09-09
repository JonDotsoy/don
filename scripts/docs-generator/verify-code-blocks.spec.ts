import { describe, expect, test } from "bun:test";
import { fillCodeResponses } from "./verify-code-blocks.ts";

describe("fillCodeResponses", () => {
  test("leaves blocks without the placeholder untouched", () => {
    const mdx = "```ts\nconsole.log(1 + 1);\n```\n";
    expect(fillCodeResponses(mdx)).toBe(mdx);
  });

  test("fills a single placeholder with the real console.log output", () => {
    const mdx = ["```ts", 'console.log("hi"); // {code_response}', "```", ""].join(
      "\n",
    );

    expect(fillCodeResponses(mdx)).toBe(
      ["```ts", 'console.log("hi"); // hi', "```", ""].join("\n"),
    );
  });

  test("fills placeholders in order across multiple console.log calls", () => {
    const mdx = [
      "```ts",
      "console.log(1 + 1); // {code_response}",
      'console.log(["a", "b"]); // {code_response}',
      "```",
      "",
    ].join("\n");

    expect(fillCodeResponses(mdx)).toBe(
      [
        "```ts",
        "console.log(1 + 1); // 2",
        'console.log(["a", "b"]); // ["a", "b"]',
        "```",
        "",
      ].join("\n"),
    );
  });

  test("resolves donly imports to local source when running snippets", () => {
    const mdx = [
      "```ts",
      'import { DON } from "donly";',
      'console.log(DON.parse(\'name "x"\')[0].name); // {code_response}',
      "```",
      "",
    ].join("\n");

    expect(fillCodeResponses(mdx)).toBe(
      [
        "```ts",
        'import { DON } from "donly";',
        'console.log(DON.parse(\'name "x"\')[0].name); // name',
        "```",
        "",
      ].join("\n"),
    );
  });

  test("throws when a code block has more placeholders than console.log calls", () => {
    const mdx = [
      "```ts",
      "console.log(1); // {code_response}",
      "// {code_response}",
      "```",
      "",
    ].join("\n");

    expect(() => fillCodeResponses(mdx)).toThrow();
  });
});
