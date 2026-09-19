import { describe, it, expect } from "bun:test";
import { join } from "node:path";
import { DonSyntaxError } from "./common/errors.js";
import { DON } from "./don";

const donModulePath = join(import.meta.dir, "don.ts");

/**
 * Regression test: the parser must validate that every opened `{` block is
 * closed before the input ends. It used to spin forever waiting for a
 * closing `}` that would never arrive, hanging the process (and growing
 * memory unbounded) instead of raising a syntax error.
 *
 * Run in a subprocess with a hard timeout so this spec fails fast instead
 * of hanging the whole test suite if the bug is ever reintroduced.
 */
describe("DON.parse syntax-error recovery", () => {
  it("should raise a syntax error for an unterminated block instead of hanging", () => {
    const proc = Bun.spawnSync({
      cmd: [
        "bun",
        "-e",
        `import { DON } from ${JSON.stringify(donModulePath)}; import { DonSyntaxError } from ${JSON.stringify(join(import.meta.dir, "common", "errors.ts"))}; try { DON.parse("foo {"); console.log("done"); } catch (err) { console.log("caught:", err instanceof Error ? err.message : err, "isDonSyntaxError:", err instanceof DonSyntaxError); }`,
      ],
      timeout: 3000,
    });

    // Bun.spawnSync reports `signalCode` as `undefined` (not `null`) for a
    // process that exits normally on its own, so we assert falsy here
    // rather than strictly `null` — the intent is just "wasn't killed by a
    // signal" (e.g. SIGTERM from the timeout), which `toBeFalsy` captures.
    expect(proc.signalCode).toBeFalsy();
    expect(proc.exitCode).toBe(0);
  });

  it("should raise a syntax error for an unterminated block at the document root", () => {
    expect(() => DON.parse("foo {")).toThrow(DonSyntaxError);
  });

  it("should raise a syntax error for an unterminated block nested inside another block", () => {
    expect(() => DON.parse("foo { bar {")).toThrow(DonSyntaxError);
  });

  it("should raise a syntax error for an unterminated block alongside other directives", () => {
    expect(() =>
      DON.parse('name "my-app"\nport 8080\nfoo {\nbar "baz"'),
    ).toThrow(DonSyntaxError);
  });
});
