/**
 * The `format` registry of the lint rules: for every format name (and alias)
 * its validator plus a short description and an example, used both to check
 * an argument and to explain a mismatch in the default issue message.
 */
import { Temporal } from "temporal-polyfill";
import { HeredocValue } from "../don.js";
import {
  isCidr,
  isEmail,
  isHostname,
  isIpv4,
  isIpv6,
  isPort,
  isRegexp,
  isSemver,
  isUrl,
  isUuid,
} from "./string-formats.js";

/** The string a `pattern` matches against: the value itself, or a heredoc's `content`. */
export const patternSubject = (value: unknown): string | undefined => {
  if (typeof value === "string") return value;
  if (value instanceof HeredocValue) return value.content;
  return undefined;
};

/**
 * Runs a `Temporal.<Type>.from()` parse over a string argument and reports
 * whether it succeeds. Only strings are checked: `from()` also accepts
 * property bags, which a DON argument can never be.
 */
const parsesAs =
  (parse: (value: string) => unknown) =>
  (value: unknown): boolean => {
    if (typeof value !== "string") return false;
    try {
      parse(value);
      return true;
    } catch {
      return false;
    }
  };

const reject = { overflow: "reject" } as const;

const isDuration = parsesAs((v) => Temporal.Duration.from(v));
const isPlainDate = parsesAs((v) => Temporal.PlainDate.from(v, reject));
const isPlainTime = parsesAs((v) => Temporal.PlainTime.from(v, reject));
const isPlainDateTime = parsesAs((v) => Temporal.PlainDateTime.from(v, reject));
const isInstant = parsesAs((v) => Temporal.Instant.from(v));
const isPlainYearMonth = parsesAs((v) =>
  Temporal.PlainYearMonth.from(v, reject),
);
const isPlainMonthDay = parsesAs((v) => Temporal.PlainMonthDay.from(v, reject));
const isZonedDateTime = parsesAs((v) => Temporal.ZonedDateTime.from(v, reject));

const tryInstant = (create: () => unknown): boolean => {
  try {
    create();
    return true;
  } catch {
    return false;
  }
};
const isEpochSeconds = (value: unknown): boolean =>
  typeof value === "number" &&
  Number.isInteger(value) &&
  tryInstant(() => Temporal.Instant.fromEpochMilliseconds(value * 1000));
const isEpochMilliseconds = (value: unknown): boolean =>
  typeof value === "number" &&
  Number.isInteger(value) &&
  tryInstant(() => Temporal.Instant.fromEpochMilliseconds(value));
const isEpochNanoseconds = (value: unknown): boolean =>
  typeof value === "bigint" &&
  tryInstant(() => Temporal.Instant.fromEpochNanoseconds(value));

const isJson = (value: unknown): boolean => {
  const text = patternSubject(value);
  if (text === undefined) return false;
  try {
    JSON.parse(text);
    return true;
  } catch {
    return false;
  }
};

interface FormatSpec {
  validate: (value: unknown) => boolean;
  /** What a valid value is, completing "must be a valid <format>: ...". */
  description: string;
  example: string;
}

const spec = (
  validate: (value: unknown) => boolean,
  description: string,
  example: string,
): FormatSpec => ({ validate, description, example });

const json = spec(isJson, "text that parses as JSON", '{"a":1}');
const duration = spec(isDuration, "an ISO 8601 duration", "P1Y2M3DT4H5M6S");
const plainDate = spec(
  isPlainDate,
  "an ISO 8601 calendar date (YYYY-MM-DD)",
  "2024-02-29",
);
const plainTime = spec(
  isPlainTime,
  "an ISO 8601 time of day (HH:mm[:ss[.fffffffff]])",
  "10:30:15",
);
const plainDateTime = spec(
  isPlainDateTime,
  "an ISO 8601 date and time without an offset (YYYY-MM-DDTHH:mm[:ss])",
  "2024-02-29T10:30:15",
);
const instant = spec(
  isInstant,
  "an ISO 8601 date and time with a Z or a UTC offset",
  "2024-02-29T10:30:15Z",
);
const plainYearMonth = spec(
  isPlainYearMonth,
  "a year and month (YYYY-MM)",
  "2024-02",
);
const plainMonthDay = spec(isPlainMonthDay, "a month and day (MM-DD)", "02-29");
const zonedDateTime = spec(
  isZonedDateTime,
  "an ISO 8601 date and time with a [time zone]",
  "2024-02-29T10:30:15+01:00[Europe/Madrid]",
);
const epochSeconds = spec(
  isEpochSeconds,
  "an integer number of seconds since the Unix epoch",
  "1709202615",
);
const epochMilliseconds = spec(
  isEpochMilliseconds,
  "an integer number of milliseconds since the Unix epoch",
  "1709202615000",
);
const epochNanoseconds = spec(
  isEpochNanoseconds,
  "a bigint number of nanoseconds since the Unix epoch",
  "1709202615000000000n",
);

const formats: Record<string, FormatSpec> = {
  json,
  url: spec(isUrl, "an absolute URL", "https://example.com/path"),
  ipv4: spec(
    isIpv4,
    "an IPv4 address with an optional /0-32 range",
    "192.0.2.1 or 10.0.0.0/8",
  ),
  ipv6: spec(
    isIpv6,
    "an IPv6 address with an optional /0-128 range",
    "2001:db8::1 or 2001:db8::/32",
  ),
  CIDR: spec(
    isCidr,
    "an IPv4 or IPv6 address with an optional range (/0-32 for IPv4, /0-128 for IPv6)",
    "10.0.0.0/8 or 2001:db8::/32",
  ),
  hostname: spec(isHostname, "an RFC 1123 hostname", "api.example.com"),
  port: spec(isPort, "an integer port from 0 to 65535", "8080"),
  uuid: spec(
    isUuid,
    "a canonical UUID",
    "123e4567-e89b-42d3-a456-426614174000",
  ),
  email: spec(isEmail, "an RFC 5322 email address", "user@example.com"),
  regexp: spec(isRegexp, "a valid JavaScript regular expression", "^[a-z]+$"),
  semver: spec(
    isSemver,
    "a Semantic Versioning 2.0.0 version",
    "1.2.3-rc.1+build.5",
  ),
  duration,
  "plain-date": plainDate,
  PlainDate: plainDate,
  "plain-time": plainTime,
  PlainTime: plainTime,
  "plain-date-time": plainDateTime,
  PlainDateTime: plainDateTime,
  instant,
  Instant: instant,
  "plain-year-month": plainYearMonth,
  PlainYearMonth: plainYearMonth,
  "plain-month-day": plainMonthDay,
  PlainMonthDay: plainMonthDay,
  "zoned-date-time": zonedDateTime,
  ZonedDateTime: zonedDateTime,
  "epoch-seconds": epochSeconds,
  EpochSeconds: epochSeconds,
  unix: epochSeconds,
  "epoch-milliseconds": epochMilliseconds,
  EpochMilliseconds: epochMilliseconds,
  "epoch-nanoseconds": epochNanoseconds,
  EpochNanoseconds: epochNanoseconds,
};

const specFor = (format: string): FormatSpec | undefined =>
  Object.hasOwn(formats, format) ? formats[format] : undefined;

/** An unknown `format` never matches, so a typo surfaces as an issue. */
export const matchesFormat = (value: unknown, format: string): boolean =>
  specFor(format)?.validate(value) ?? false;

/**
 * The default issue message for a value that fails `format`, or `undefined`
 * when `value` actually satisfies it. It names the format, says what a valid
 * value looks like and gives an example — never the offending value itself,
 * which may be a secret.
 */
export const formatMismatchMessage = (
  argIndex: number,
  value: unknown,
  format: string,
): string | undefined => {
  if (matchesFormat(value, format)) return undefined;
  const found = specFor(format);
  if (!found) {
    return `argument at position ${argIndex} has an unknown format "${format}"`;
  }
  return `argument at position ${argIndex} must be a valid ${format}: ${found.description} (e.g. ${found.example})`;
};
