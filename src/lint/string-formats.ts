/**
 * Validators for the dependency-free `format` values of `"string"` (and
 * `"number"`, for `port`) arguments. Each takes the raw argument and returns
 * `false` for anything that is not the expected kind of value.
 */

const asString = (value: unknown): string | undefined =>
  typeof value === "string" ? value : undefined;

/** `URL.canParse`: any absolute URL the WHATWG URL parser accepts. */
export const isUrl = (value: unknown): boolean => {
  const text = asString(value);
  return text !== undefined && URL.canParse(text);
};

// Four dot-separated decimal groups of 1-3 digits, without leading zeros.
const IPV4_SHAPE_RE = /^(?:0|[1-9]\d{0,2})(?:\.(?:0|[1-9]\d{0,2})){3}$/;

// A CIDR prefix length: 0-32 without leading zeros (checked with Number below).
const IPV4_PREFIX_RE = /^(?:0|[1-9]\d?)$/;

/**
 * Dotted-quad IPv4, optionally followed by a CIDR range (`<ip>/<range>`).
 * The shape is checked with a regular expression, then the address is split
 * on `.` and every part, converted with `Number(part)`, must fit in one byte
 * (0-255). When a `/<range>` is present it must be an integer from 0 to 32.
 */
export const isIpv4 = (value: unknown): boolean => {
  const text = asString(value);
  if (text === undefined) return false;
  const [address, prefix, ...rest] = text.split("/");
  if (rest.length > 0 || address === undefined) return false;
  if (!IPV4_SHAPE_RE.test(address)) return false;
  if (!address.split(".").every((part) => Number(part) <= 255)) return false;
  if (prefix === undefined) return true;
  return IPV4_PREFIX_RE.test(prefix) && Number(prefix) <= 32;
};

/**
 * IPv6 in any textual form (`::1`, `2001:db8::1`, `::ffff:1.2.3.4`), without
 * brackets or a zone id. Delegates the grammar to the URL parser's IPv6 host
 * parsing, after rejecting everything that is not an address character.
 */
export const isIpv6 = (value: unknown): boolean => {
  const text = asString(value);
  return (
    text !== undefined &&
    text.includes(":") &&
    /^[0-9a-fA-F:.]+$/.test(text) &&
    URL.canParse(`http://[${text}]`)
  );
};

const HOST_LABEL_RE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;

/**
 * RFC 1123 hostname: dot-separated labels of 1-63 letters, digits or hyphens
 * (not starting or ending with a hyphen), at most 253 characters, optionally
 * ending in the root dot. The last label can't be all digits, so an IPv4
 * address is not a hostname.
 */
export const isHostname = (value: unknown): boolean => {
  const text = asString(value);
  if (text === undefined) return false;
  const name = text.endsWith(".") ? text.slice(0, -1) : text;
  if (name.length === 0 || name.length > 253) return false;
  const labels = name.split(".");
  return (
    labels.every((label) => HOST_LABEL_RE.test(label)) &&
    !/^\d+$/.test(labels[labels.length - 1]!)
  );
};

/** A TCP/UDP port: an integer `number` from 0 to 65535. */
export const isPort = (value: unknown): boolean =>
  typeof value === "number" &&
  Number.isInteger(value) &&
  value >= 0 &&
  value <= 65535;

const UUID_RE =
  /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$/i;

/**
 * Canonical 8-4-4-4-12 UUID (RFC 9562), any case: versions 1-8 with the RFC
 * variant, plus the nil and max UUIDs.
 */
export const isUuid = (value: unknown): boolean => {
  const text = asString(value);
  return text !== undefined && UUID_RE.test(text);
};

// RFC 5322 `atext`, `qtext` and `quoted-pair`, without obsolete syntax,
// comments or folding whitespace.
const ATEXT = "[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]";
const DOT_ATOM = `${ATEXT}+(?:\\.${ATEXT}+)*`;
const QUOTED_STRING = '"(?:[\\x21\\x23-\\x5B\\x5D-\\x7E ]|\\\\[\\x20-\\x7E])*"';
const LOCAL_PART_RE = new RegExp(`^(?:${DOT_ATOM}|${QUOTED_STRING})$`);

/**
 * RFC 5322 `addr-spec` (`local-part@domain`): a dot-atom or quoted-string
 * local part, and a domain that is a hostname or an address literal
 * (`[192.0.2.1]`, `[IPv6:::1]`). Also enforces the RFC 5321 length limits
 * (64 for the local part, 254 overall). Comments, folding whitespace and the
 * obsolete syntax of RFC 5322 are not accepted.
 */
export const isEmail = (value: unknown): boolean => {
  const text = asString(value);
  if (text === undefined || text.length > 254) return false;
  const at = text.lastIndexOf("@");
  if (at < 1) return false;
  const local = text.slice(0, at);
  const domain = text.slice(at + 1);
  if (local.length > 64 || !LOCAL_PART_RE.test(local)) return false;
  if (domain.startsWith("[") && domain.endsWith("]")) {
    const literal = domain.slice(1, -1);
    return literal.startsWith("IPv6:")
      ? isIpv6(literal.slice("IPv6:".length))
      : isIpv4(literal);
  }
  return isHostname(domain) && !domain.endsWith(".");
};

/** A string that compiles as a JavaScript `RegExp` source. */
export const isRegexp = (value: unknown): boolean => {
  const text = asString(value);
  if (text === undefined) return false;
  try {
    new RegExp(text);
    return true;
  } catch {
    return false;
  }
};

const SEMVER_RE =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;

/** A Semantic Versioning 2.0.0 version, e.g. `1.2.3-rc.1+build.5` (no `v`). */
export const isSemver = (value: unknown): boolean => {
  const text = asString(value);
  return text !== undefined && SEMVER_RE.test(text);
};
