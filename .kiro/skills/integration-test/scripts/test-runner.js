import { DON } from "@jondotsoy/don";
import { readFileSync } from "fs";

const tests = JSON.parse(readFileSync("cases.json", "utf-8"));
const results = [];

for (const test of tests) {
  try {
    const content = readFileSync(test.name, "utf-8");
    const obj = DON.parse(content);

    if (!obj) {
      throw new Error("Parse returned null or undefined");
    }

    console.log(`✓ ${test.name}: PASSED`);
    results.push({ name: test.name, status: "PASSED" });
  } catch (error) {
    console.error(`✗ ${test.name}: FAILED - ${error.message}`);
    results.push({ name: test.name, status: "FAILED" });
  }
}

console.log("\n===================================");
console.log("Test Results Summary");
console.log("===================================\n");
console.log("| Test Name                      | Status     |");
console.log("|--------------------------------|------------|");

for (const result of results) {
  console.log(`| ${result.name.padEnd(30)} | ${result.status.padEnd(10)} |`);
}

const passed = results.filter((r) => r.status === "PASSED").length;
const failed = results.filter((r) => r.status === "FAILED").length;

console.log(
  `\nTotal: ${results.length} | Passed: ${passed} | Failed: ${failed}\n`,
);

process.exit(failed > 0 ? 1 : 0);
