/**
 * `tableOfContents()` can be called before headings that will appear later
 * in the document, so its output can't be computed at call time — a
 * placeholder is recorded instead and resolved once every fragment (and
 * thus every heading) is known.
 */
export const TOC_PLACEHOLDER = "<!--@spec-generator/table-of-contents-->";

const HEADING_RE = /^(#{2,6})\s+(.+)$/;

/** Mirrors GitHub's heading-slug algorithm closely enough to match the hand-authored spec.md. */
const slugify = (text: string): string =>
  text
    .toLowerCase()
    .trim()
    .replace(/[^\w\- ]+/g, "")
    .replace(/\s+/g, "-");

const extractHeadings = (fragments: readonly string[]) =>
  fragments
    .map((fragment) => HEADING_RE.exec(fragment))
    .filter((match): match is RegExpExecArray => match !== null)
    .map((match) => ({ level: match[1]!.length, text: match[2]!.trim() }));

/** Renders a nested bullet list linking every `##`-`######` heading found in `fragments`. */
export const renderTableOfContents = (fragments: readonly string[]): string => {
  const headings = extractHeadings(fragments);
  if (!headings.length) return "";

  const minLevel = Math.min(...headings.map((heading) => heading.level));

  return headings
    .map(
      (heading) =>
        `${"  ".repeat(heading.level - minLevel)}- [${heading.text}](#${slugify(heading.text)})`,
    )
    .join("\n");
};

/** Replaces every `tableOfContents()` placeholder with the rendered table of contents. */
export const resolveTableOfContents = (
  fragments: readonly string[],
): string[] => {
  if (!fragments.includes(TOC_PLACEHOLDER)) return [...fragments];

  const toc = renderTableOfContents(fragments);

  return fragments
    .map((fragment) => (fragment === TOC_PLACEHOLDER ? toc : fragment))
    .filter((fragment) => fragment !== "");
};
