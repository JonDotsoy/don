import { randomUUID } from "node:crypto";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { pathToFileURL } from "node:url";
import { SpecDocument } from "./document.ts";
import type { GeneratorModule } from "./types.ts";

export interface CompiledSpec {
  meta: GeneratorModule;
  fragments: readonly string[];
}

const REQUIRED_KEYS: (keyof GeneratorModule)[] = [
  "status",
  "title",
  "description",
  "lang",
];

const assertGeneratorModule = (
  mod: Record<string, unknown>,
  generatorPath: string,
): GeneratorModule => {
  const missing = REQUIRED_KEYS.filter((key) => typeof mod[key] !== "string");
  if (missing.length) {
    throw new Error(
      `${generatorPath}: missing required export(s): ${missing.join(", ")}`,
    );
  }

  return mod as unknown as GeneratorModule;
};

/**
 * Runs a `_generator_specs.ts` file: its top-level `mdLine`/`block` calls are
 * recorded by injecting them as globals for the duration of the import, so
 * the generator file itself needs no imports of its own.
 *
 * The file is imported from a throwaway copy under a fresh, unique path each
 * time, rather than the original path: the runtime's ES module cache never
 * re-runs a module's top-level code for a specifier it has already
 * evaluated, which would silently skip the mdLine/block calls (and reuse
 * whichever SpecDocument happened to be current the first time) on any
 * second compile of the same file within one process — e.g. across tests.
 */
export const compileSpec = async (
  generatorPath: string,
): Promise<CompiledSpec> => {
  const doc = new SpecDocument();
  const globals = globalThis as Record<string, unknown>;
  const previous = {
    mdLine: globals.mdLine,
    block: globals.block,
    tableOfContents: globals.tableOfContents,
  };

  globals.mdLine = doc.mdLine;
  globals.block = doc.block;
  globals.tableOfContents = doc.tableOfContents;

  const tempPath = path.join(
    os.tmpdir(),
    `spec-generator-${randomUUID()}${path.extname(generatorPath)}`,
  );
  fs.copyFileSync(generatorPath, tempPath);

  try {
    const mod = await import(pathToFileURL(tempPath).href);
    const meta = assertGeneratorModule(mod, generatorPath);

    return { meta, fragments: doc.fragments };
  } finally {
    globals.mdLine = previous.mdLine;
    globals.block = previous.block;
    globals.tableOfContents = previous.tableOfContents;
    fs.rmSync(tempPath, { force: true });
  }
};
