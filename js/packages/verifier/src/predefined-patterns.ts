/**
 * The Java regexes behind the YAML `predefined:` names and the `by_date` / `by_time` /
 * `by_timestamp` matchers, copied from the JVM's `RegexPatterns` and `UrlHelper`
 * (specs/stubborn-contract-spec-java/.../spec/internal/) and mapped as
 * `YamlToContracts.predefinedToPattern` maps them.
 *
 * Only the pattern text is kept: the generated test calls `Pattern.pattern()` and matches with
 * `String.matches`, so flags such as `uuid`'s `CASE_INSENSITIVE` are lost on the JVM as well.
 */

const URL_SCHEME = "[A-Za-z][+-.\\w^_]*:";
const URL_AUTHORITATIVE_DECLARATION = "/{2}";
const URL_USERINFO = "(?:\\S+(?::\\S*)?@)?";
const URL_HOST =
  "(?:" +
  "(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)" +
  "|" +
  "(?:(?:[a-z\\u00a1-\\uffff0-9]-*)*[a-z\\u00a1-\\uffff0-9]+)" +
  "(?:\\.(?:[a-z\\u00a1-\\uffff0-9]-*)*[a-z\\u00a1-\\uffff0-9]+)*" +
  "(?:\\.(?:[a-z\\u00a1-\\uffff]{2,}))|(?:localhost))";
const URL_PORT = "(?::\\d{2,5})?";
const URL_RESOURCE_PATH = "(?:/\\S*)?";

/** `RegexPatterns.ANY_DATE`, used by `predefined: iso_date` and `by_date`. */
export const ISO_DATE = "(\\d\\d\\d\\d)-(0[1-9]|1[012])-(0[1-9]|[12][0-9]|3[01])";
/** `RegexPatterns.ANY_DATE_TIME`, used by `predefined: iso_date_time` and `by_timestamp`. */
export const ISO_DATE_TIME =
  "([0-9]{4})-(1[0-2]|0[1-9])-(3[01]|0[1-9]|[12][0-9])T(2[0-3]|[01][0-9]):([0-5][0-9]):([0-5][0-9])";
/** `RegexPatterns.ANY_TIME`, used by `predefined: iso_time` and `by_time`. */
export const ISO_TIME = "(2[0-3]|[01][0-9]):([0-5][0-9]):([0-5][0-9])";

/** `YamlContract.PredefinedRegex` name → Java regex. */
export const PREDEFINED_PATTERNS: Readonly<Record<string, string>> = {
  only_alpha_unicode: "[\\p{L}]*",
  number: "-?(\\d*\\.\\d+|\\d+)",
  any_double: "-?(\\d*\\.\\d+)",
  any_boolean: "(true|false)",
  ip_address:
    "([01]?\\d\\d?|2[0-4]\\d|25[0-5])\\.([01]?\\d\\d?|2[0-4]\\d|25[0-5])\\.([01]?\\d\\d?|2[0-4]\\d|25[0-5])\\.([01]?\\d\\d?|2[0-4]\\d|25[0-5])",
  hostname: "((http[s]?|ftp):/)/?([^:/\\s]+)(:[0-9]{1,5})?",
  email: "[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,6}",
  url:
    "^(?:(?:" +
    URL_SCHEME +
    URL_AUTHORITATIVE_DECLARATION +
    ")?" +
    URL_USERINFO +
    URL_HOST +
    URL_PORT +
    URL_RESOURCE_PATH +
    ")$",
  uuid: "[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}",
  iso_date: ISO_DATE,
  iso_date_time: ISO_DATE_TIME,
  iso_time: ISO_TIME,
  iso_8601_with_offset:
    "([0-9]{4})-(1[0-2]|0[1-9])-(3[01]|0[1-9]|[12][0-9])T(2[0-3]|[01][0-9]):([0-5][0-9]):([0-5][0-9])(\\.\\d+)?(Z|[+-][01]\\d:[0-5]\\d)",
  non_empty: "[\\S\\s]+",
  non_blank: "^\\s*\\S[\\S\\s]*",
};

/** The Java regex of a predefined name, or undefined for a name the JVM does not know. */
export function predefinedPattern(name: string): string | undefined {
  return Object.hasOwn(PREDEFINED_PATTERNS, name) ? PREDEFINED_PATTERNS[name] : undefined;
}
