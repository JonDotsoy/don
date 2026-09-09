const CODE_FENCE = /```[\s\S]*?```/g;

const stripImportsAndExports = (text: string): string =>
  text.replace(/^\s*(import\s.+from\s+["'].+["'];?|export\s+.+)\s*$/gm, "");

const stripJsxComments = (text: string): string =>
  text.replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, "");

const stripCustomComponents = (text: string): string =>
  text
    // Self-closing custom components: <Foo ... />
    .replace(/<([A-Z]\w*)(\s[^>]*)?\/>/g, "")
    // Paired custom components: <Foo ...>children</Foo> — keep the children.
    .replace(/<([A-Z]\w*)(\s[^>]*)?>([\s\S]*?)<\/\1>/g, "$3");

/**
 * Converts MDX source into plain Markdown by removing MDX-only constructs
 * (imports/exports, JSX comments, custom JSX components) while leaving
 * standard Markdown and native HTML tags untouched. Code fences are left
 * as-is so example code is never rewritten.
 */
export const mdxToMarkdown = (mdx: string): string => {
  const segments = mdx.split(CODE_FENCE);
  const fences = mdx.match(CODE_FENCE) ?? [];

  const converted = segments.map((segment) =>
    stripCustomComponents(stripJsxComments(stripImportsAndExports(segment))),
  );

  let result = converted[0] ?? "";
  for (let i = 0; i < fences.length; i++) {
    result += fences[i] + (converted[i + 1] ?? "");
  }

  return result.replace(/\n{3,}/g, "\n\n").replace(/^\s+/, "");
};
