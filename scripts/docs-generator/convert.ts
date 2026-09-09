import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkMdx from "remark-mdx";
import remarkStringify from "remark-stringify";
import type { Root, RootContent } from "mdast";

const isCommentExpression = (value: unknown): boolean => {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed.startsWith("/*") && trimmed.endsWith("*/");
};

/** Drops MDX-only nodes (imports/exports, JSX comments, custom JSX
 * components) from an mdast tree, unwrapping custom components into their
 * children so their content survives in plain Markdown. Native (lowercase)
 * JSX/HTML tags are left in place. */
const stripMdxNodes = (node: Root | RootContent): void => {
  const parent = node as { children?: RootContent[] };
  if (!parent.children) return;

  const kept: RootContent[] = [];
  for (const child of parent.children) {
    if (child.type === "mdxjsEsm") continue;

    if (
      (child.type === "mdxFlowExpression" ||
        child.type === "mdxTextExpression") &&
      isCommentExpression((child as { value?: unknown }).value)
    ) {
      continue;
    }

    if (
      child.type === "mdxJsxFlowElement" ||
      child.type === "mdxJsxTextElement"
    ) {
      const name = (child as { name?: string | null }).name ?? "";
      if (/^[A-Z]/.test(name)) {
        stripMdxNodes(child);
        kept.push(...((child as { children?: RootContent[] }).children ?? []));
        continue;
      }
    }

    stripMdxNodes(child);
    kept.push(child);
  }

  parent.children = kept;
};

const parser = unified().use(remarkParse).use(remarkMdx);
const serializer = unified()
  .use(remarkStringify, { bullet: "-", fences: true })
  .use(remarkMdx);

/**
 * Converts MDX source into plain Markdown by parsing it with the same
 * MDX syntax extension the MDX compiler itself uses (remark-mdx), removing
 * MDX-only constructs from the resulting AST, and re-serializing it.
 */
export const mdxToMarkdown = (mdx: string): string => {
  const tree = parser.parse(mdx) as Root;
  stripMdxNodes(tree);
  return serializer.stringify(tree);
};
