import { describe, expect, it } from "bun:test";
import { trimLibPackageJson } from "./pm.ts";

describe("trimLibPackageJson", () => {
  it("rewrites ./lib/... paths and drops dev-only fields", () => {
    const pkg = {
      name: "donly",
      version: "1.2.3",
      main: "./lib/index.js",
      types: "./lib/index.d.ts",
      bin: { donly: "./lib/bin/donly.js" },
      exports: {
        ".": { types: "./lib/index.d.ts", import: "./lib/index.js" },
        "./lint": {
          types: "./lib/lint/lint.d.ts",
          import: "./lib/lint/lint.js",
        },
      },
      files: ["lib"],
      scripts: { build: "bun run scripts/pm.ts pack" },
      devDependencies: { typescript: "^5" },
    };

    expect(trimLibPackageJson(pkg)).toMatchSnapshot();
  });

  it("leaves paths outside ./lib/ untouched", () => {
    const pkg = {
      name: "donly",
      homepage: "https://don.jon.soy/",
      repository: { type: "git", url: "https://github.com/JonDotsoy/don" },
    };

    expect(trimLibPackageJson(pkg)).toMatchSnapshot();
  });
});
