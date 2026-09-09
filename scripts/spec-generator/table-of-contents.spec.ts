import { describe, expect, it } from "bun:test";
import { renderTableOfContents, resolveTableOfContents, TOC_PLACEHOLDER } from "./table-of-contents.ts";

describe("renderTableOfContents", () => {
  it("returns an empty string when there are no headings", () => {
    expect(renderTableOfContents(["Just a paragraph.", "```don\nfoo\n```"])).toBe("");
  });

  it("ignores the H1 and links every H2-H6 heading", () => {
    const toc = renderTableOfContents([
      "# DON Specification v1",
      "## 1. Overview",
      "Some paragraph.",
      "## 1.1 DON vs JSON",
    ]);

    expect(toc).toBe(
      "- [1. Overview](#1-overview)\n" + "- [1.1 DON vs JSON](#11-don-vs-json)",
    );
  });

  it("nests deeper headings relative to the shallowest one found", () => {
    const toc = renderTableOfContents([
      "## 1. Overview",
      "### Design Goals",
      "## 2. Syntax",
    ]);

    expect(toc).toBe(
      "- [1. Overview](#1-overview)\n" + "  - [Design Goals](#design-goals)\n" + "- [2. Syntax](#2-syntax)",
    );
  });
});

describe("resolveTableOfContents", () => {
  it("returns the fragments unchanged when there is no placeholder", () => {
    const fragments = ["# Title", "## Section"];

    expect(resolveTableOfContents(fragments)).toEqual(fragments);
  });

  it("replaces the placeholder with the rendered table of contents", () => {
    const fragments = ["# DON Specification v1", TOC_PLACEHOLDER, "## 1. Overview", "## 1.1 DON vs JSON"];

    expect(resolveTableOfContents(fragments)).toEqual([
      "# DON Specification v1",
      "- [1. Overview](#1-overview)\n- [1.1 DON vs JSON](#11-don-vs-json)",
      "## 1. Overview",
      "## 1.1 DON vs JSON",
    ]);
  });

  it("drops the placeholder entirely when no headings exist to link", () => {
    const fragments = ["# Title", TOC_PLACEHOLDER, "Just a paragraph."];

    expect(resolveTableOfContents(fragments)).toEqual(["# Title", "Just a paragraph."]);
  });
});
