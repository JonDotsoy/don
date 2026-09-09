import type { GeneratorModule } from "./types.ts";

const renderFrontmatter = (meta: GeneratorModule): string => {
  const description = meta.description.trim().replace(/\s*\n\s*/g, " ");

  return [
    "---",
    `title: ${meta.title}`,
    `description: ${description}`,
    `lang: ${meta.lang}`,
    "---",
  ].join("\n");
};

/**
 * Combines the compiled frontmatter and body fragments into the final
 * markdown document, inserting the `> **Status**` line right after the
 * first `#` heading (matching the hand-authored spec.md convention).
 */
export const renderDocument = (
  meta: GeneratorModule,
  fragments: readonly string[],
): string => {
  const frontmatter = renderFrontmatter(meta);
  const statusLine = `> **Status**: ${meta.status}`;

  const body = [...fragments];
  const h1Index = body.findIndex((fragment) => fragment.startsWith("# "));

  if (h1Index === -1) {
    body.unshift(statusLine);
  } else {
    body.splice(h1Index + 1, 0, statusLine);
  }

  return `${frontmatter}\n\n${body.join("\n\n")}\n`;
};
