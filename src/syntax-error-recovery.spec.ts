import { describe, it, expect } from "bun:test";
import { join } from "node:path";

const donModulePath = join(import.meta.dir, "don.ts");

/**
 * Known bug: the parser never validates that every opened `{` block is
 * closed before the input ends. Instead of raising a syntax error for an
 * unterminated block, it spins forever waiting for a closing `}` that will
 * never arrive, hanging the process (and growing memory unbounded).
 *
 * Run in a subprocess with a hard timeout so this spec fails fast instead
 * of hanging the whole test suite. This test is expected to FAIL until the
 * lexer/syntax parser is fixed to reject unterminated blocks.
 */
describe("DON.parse syntax-error recovery (known bugs, not yet fixed)", () => {
  it("should raise a syntax error for an unterminated block instead of hanging", () => {
    const proc = Bun.spawnSync({
      cmd: [
        "bun",
        "-e",
        `import { DON } from ${JSON.stringify(donModulePath)}; DON.parse("foo {"); console.log("done");`,
      ],
      timeout: 3000,
    });

    expect(proc.signalCode).toBeNull();
    expect(proc.exitCode).toBe(0);
  });
});
