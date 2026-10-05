import { describe, test, expect } from "bun:test";
import { Temporal } from "temporal-polyfill";
import { lintSchema } from "./lint-schema";
import type { ArgumentType } from "./schema";

/**
 * Cross-checks the Temporal-inspired argument types against the reference
 * implementation (`temporal-polyfill`): a value is accepted by the lint type
 * exactly when `Temporal.<Type>.from()` accepts it.
 */
const parsers: Record<string, (value: string) => unknown> = {
  duration: (v) => Temporal.Duration.from(v),
  "plain-date": (v) => Temporal.PlainDate.from(v),
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
