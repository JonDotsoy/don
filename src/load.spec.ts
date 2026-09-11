import { describe, it, expect, afterEach } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { load } from "./load";

describe("load", () => {
  const dirs: string[] = [];

  afterEach(async () => {
    while (dirs.length) {
      await rm(dirs.pop()!, { recursive: true, force: true });
    }
  });

  const writeDonlyFile = async (content: string) => {
    const dir = await mkdtemp(join(tmpdir(), "donly-load-"));
    dirs.push(dir);
    const filePath = join(dir, "file.donly");
    await writeFile(filePath, content, "utf8");
    return filePath;
  };

  it("reads and parses a file into a nested object", async () => {
    const filePath = await writeDonlyFile(""
      + 'name "my-app"\n'
      + "port 8080\n"
    );

    const obj = await load(filePath);

    expect(obj).toEqual({ name: "my-app", port: 8080 });
  });

  it("nests directive args into keys", async () => {
    const filePath = await writeDonlyFile(""
      + "database host localhost\n"
      + "database port 5432\n"
    );

    const obj = await load(filePath);

    expect(obj).toEqual({
      database: [
        { host: "localhost" },
        { port: 5432 },
      ],
    });
  });

  it("parses nested blocks", async () => {
    const filePath = await writeDonlyFile(""
      + "server {\n"
      + '  host "localhost"\n'
      + "  port 8080\n"
      + "}\n"
    );

    const obj = await load(filePath);

    expect(obj).toEqual({
      server: { host: "localhost", port: 8080 },
    });
  });
});
