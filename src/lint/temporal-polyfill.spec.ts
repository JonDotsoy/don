import { describe, test, expect } from "bun:test";
import { Temporal } from "temporal-polyfill";
import { lintSchema } from "./lint-schema";
import type { ArgumentType, LintRuleDocument } from "./schema";

/**
 * The Temporal-inspired argument types are backed by `temporal-polyfill`: a
 * value is accepted by the lint type exactly when `Temporal.<Type>.from()`
 * accepts it (with `overflow: "reject"`).
 */
const parsers: Record<string, (value: string) => unknown> = {
  duration: (v) => Temporal.Duration.from(v),
  "plain-date": (v) => Temporal.PlainDate.from(v, { overflow: "reject" }),
  "plain-time": (v) => Temporal.PlainTime.from(v),
  "plain-date-time": (v) => Temporal.PlainDateTime.from(v),
  instant: (v) => Temporal.Instant.from(v),
  "plain-year-month": (v) => Temporal.PlainYearMonth.from(v),
  "plain-month-day": (v) => Temporal.PlainMonthDay.from(v),
  "zoned-date-time": (v) => Temporal.ZonedDateTime.from(v),
};

const samples: Record<string, string[]> = {
  duration: ["P1Y2M3DT4H5M6.5S", "PT30M", "-P1W", "P1D", "PT0.5S", "P", "PT", "P1DT", "1D", "PT1.5X"],
  "plain-date": ["2024-02-29", "2023-02-29", "2024-13-01", "2024-1-1", "20240229", "abc", "2024-02-3", "2024-0229"],
  "plain-time": ["10:30", "10:30:15", "10:30:15.123456789", "23:59", "24:00", "10", "10:60", "T10:30", "1030", "103015", "10:3015", "1"],
  "plain-date-time": ["2024-02-29T10:30", "2024-02-29T10:30:00", "2024-02-29 10:30", "2024-02-30T10:30", "2024-02-29T10:30Z", "2024-02-29"],
  instant: ["2024-02-29T10:30:00Z", "2024-02-29T10:30Z", "2024-02-29T10:30:00.123+02:00", "2024-02-29T10:30:00", "2024-02-30T10:30:00Z", "2024-02-29"],
  "plain-year-month": ["2024-02", "2024-13", "2024-00", "2024-2", "2024"],
  "plain-month-day": ["02-29", "--02-29", "02-30", "13-01", "2-29", "04-31"],
  "zoned-date-time": [
    "2024-02-29T10:30:00+01:00[Europe/Madrid]",
    "2024-02-29T10:30[Europe/Madrid]",
    "2024-02-29T10:30:00Z[UTC]",
    "2024-02-29T10:30[+02:00]",
    "2024-02-29T10:30[Not/AZone]",
    "2024-02-29T10:30:00+01:00",
    "2024-02-30T10:30[UTC]",
  ],
};

const accepts = (type: ArgumentType, value: string): boolean =>
  lintSchema(`d ${JSON.stringify(value)}`, { "/d": { "[1]": { type } } }).length === 0;

const polyfillAccepts = (type: string, value: string): boolean => {
  try {
    parsers[type]!(value);
    return true;
  } catch {
    return false;
  }
};

describe("Temporal types agree with temporal-polyfill", () => {
  for (const [type, values] of Object.entries(samples)) {
    test(type, () => {
      for (const value of values) {
        expect([value, accepts(type as ArgumentType, value)]).toEqual([
          value,
          polyfillAccepts(type, value),
        ]);
      }
    });
  }
});

/**
 * Edge cases with explicit expectations (not just "agrees with the
 * polyfill"), so a behavior change in Temporal or the polyfill is caught.
 */
const edgeCases: Record<string, { accept: string[]; reject: string[] }> = {
  duration: {
    accept: ["P1Y", "PT0S", "P0D", "-PT5S", "+P1D", "p1d", "pt1h", "PT1,5S", "P1W1D", "P99999999999D"],
    reject: ["", "P", "PT", "P1DT", "P1D1Y", "PT1S1M", "P 1D", "P1D ", "P-1D", "P1.5D", "P1,5D", "PT0.1234567891S"],
  },
  "plain-date": {
    accept: ["0000-01-01", "9999-12-31", "+010000-01-01", "-000001-01-01", "2000-02-29", "2024-02-29[u-ca=iso8601]", "2024-02-29T10:30"],
    reject: ["", " 2024-02-29", "2024-02-29 ", "1900-02-29", "2023-02-29", "2024-04-31", "2024-00-10", "2024-01-00", "-000000-01-01", "2024-02-29Z"],
  },
  "plain-time": {
    accept: ["00:00", "23:59:59", "23:59:59.999999999", "12:30:15,5", "T12:30", "t12:30", "103015", "12:30[UTC]"],
    reject: ["", "0", "12:5", "24:00", "12:60", "12:30:15.", "23:59:59.9999999999", "12:30Z"],
  },
  "plain-date-time": {
    accept: ["2024-02-29T00:00", "2024-02-29T23:59:59.999999999", "2024-02-29t10:30", "2024-02-29 10:30", "2024-02-29", "2024-02-29T10:30[UTC]"],
    reject: ["", "10:30", "1900-02-29T10:30", "2024-02-29T24:00", "2024-02-29T10:30Z"],
  },
  instant: {
    accept: ["1970-01-01T00:00:00Z", "1970-01-01T00:00Z", "2024-02-29T10:30:00z", "2024-02-29 10:30:00Z", "2024-02-29T10:30:00+00:00", "2024-02-29T10:30:00-23:59", "2024-02-29T10:30:00.123456789Z", "2024-02-29T10:30:00+01:00[Europe/Madrid]", "-271821-04-20T00:00:00Z", "+275760-09-13T00:00:00Z"],
    reject: ["", "2024-02-29", "10:30Z", "2024-02-29T10:30:00", "2024-02-29T10:30:00+24:00", "2024-02-30T10:30:00Z", "-271821-04-19T23:59:59Z", "+275760-09-13T00:00:01Z"],
  },
  "plain-year-month": {
    accept: ["0000-01", "2024-02", "2024-12", "-000001-01", "+010000-01", "2024-02[u-ca=iso8601]"],
    reject: ["", "2024", "2024-1", "2024-00", "2024-13", "--02"],
  },
  "plain-month-day": {
    accept: ["02-29", "--02-29", "12-31", "01-01", "02-29[u-ca=iso8601]"],
    reject: ["", "1-1", "00-10", "01-00", "02-30", "04-31", "13-01"],
  },
  "zoned-date-time": {
    accept: ["2024-02-29T10:30[UTC]", "2024-02-29T10:30Z[UTC]", "2024-02-29T10:30[+01:00]", "2024-02-29T10:30[-23:59]", "2024-02-29T10:30[America/New_York]", "2024-02-29T10:30[Etc/GMT+5]", "2024-03-10T02:30[America/New_York]", "2024-11-03T01:30-04:00[America/New_York]", "2024-11-03T01:30-05:00[America/New_York]"],
    reject: ["", "2024-02-29T10:30", "2024-02-29T10:30+01:00", "2024-02-29T10:30[]", "2024-02-29T10:30[ UTC]", "2024-02-29T10:30[Not/AZone]", "2024-02-30T10:30[UTC]", "2024-11-03T01:30-06:00[America/New_York]"],
  },
};

describe("Temporal types edge cases", () => {
  for (const [type, { accept, reject }] of Object.entries(edgeCases)) {
    test(`${type} accepts`, () => {
      for (const value of accept)
        expect([value, accepts(type as ArgumentType, value)]).toEqual([value, true]);
    });
    test(`${type} rejects`, () => {
      for (const value of reject)
        expect([value, accepts(type as ArgumentType, value)]).toEqual([value, false]);
    });
  }

  test("PascalCase aliases behave like their kebab-case types", () => {
    const aliases: [ArgumentType, ArgumentType, string][] = [
      ["PlainDate", "plain-date", "2024-02-29"],
      ["PlainTime", "plain-time", "10:30"],
      ["PlainDateTime", "plain-date-time", "2024-02-29T10:30"],
      ["Instant", "instant", "2024-02-29T10:30:00Z"],
      ["PlainYearMonth", "plain-year-month", "2024-02"],
      ["PlainMonthDay", "plain-month-day", "02-29"],
      ["ZonedDateTime", "zoned-date-time", "2024-02-29T10:30[UTC]"],
    ];
    for (const [alias, type, value] of aliases) {
      expect(accepts(alias, value)).toBe(true);
      expect(accepts(alias, "nope")).toBe(accepts(type, "nope"));
    }
  });

  test("rejects non-string arguments for every type", () => {
    const literals = ["123", "123n", "true", "null", "0x10"];
    for (const type of Object.keys(edgeCases)) {
      for (const literal of literals) {
        const issues = lintSchema(`d ${literal}`, {
          "/d": { "[1]": { type: type as ArgumentType } },
        });
        expect([type, literal, issues.length]).toEqual([type, literal, 1]);
      }
    }
  });

  test("rejects a heredoc argument", () => {
    const issues = lintSchema("d <<<EOT\n  2024-02-29\nEOT\n", {
      "/d": { "[1]": { type: "plain-date" } },
    });
    expect(issues).toHaveLength(1);
  });

  test("works together with enum/not/or on the same argument", () => {
    const rule = {
      "/d": { "[1]": { or: [{ type: "plain-date" }, { type: "duration" }] } },
      "/n": { "[1]": { not: { type: "instant" } } },
    } satisfies LintRuleDocument;
    expect(lintSchema('d "2024-02-29"\nd "P1D"\nn "nope"', rule)).toHaveLength(0);
    expect(lintSchema('d "nope"', rule)).toHaveLength(1);
    expect(lintSchema('n "2024-02-29T10:30:00Z"', rule)).toHaveLength(1);
  });
});
