import type { GeneratorModule } from "./types.ts";

const renderFrontmatter = (
  meta: GeneratorModule,
  generatedAt: Date,
): string => {
  const description = meta.description.trim().replace(/\s*\n\s*/g, " ");

  return [
    "---",
    `title: ${meta.title}`,
    `description: ${description}`,
    `lang: ${meta.lang}`,
    `status: ${meta.status}`,
    `generatedAt: ${generatedAt.toISOString()}`,
    "---",
  ].join("\n");
};

/**
 * Combines the compiled frontmatter and body fragments into the final
 * markdown document, inserting the `> **Status**` line right after the
 * first `#` heading (matching the hand-authored spec.md convention).
 * `status` and `generatedAt` are also written into the frontmatter.
 */
export const renderDocument = (
  meta: GeneratorModule,
  fragments: readonly string[],
  generatedAt: Date = new Date(),
): string => {
  const frontmatter = renderFrontmatter(meta, generatedAt);
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
