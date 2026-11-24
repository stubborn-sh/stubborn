import { isDeepStrictEqual } from "node:util";
import { javaFullMatchRegex } from "@stubborn-sh/stub-server";

/** Maximum regex pattern length to prevent ReDoS. */
const MAX_REGEX_LENGTH = 1000;

/**
 * Match a value against a regex pattern, as the generated test's
 * `assertThat(parsedJson.read(path, String.class)).matches(regex)`: Jayway reads numbers and
 * booleans as their text, so they are matched too; objects, lists and null never match.
 */
export function byRegex(value: unknown, pattern: string): boolean {
  if (typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean") {
    return false;
  }
  if (pattern.length > MAX_REGEX_LENGTH) {
    return false;
  }
  // Contract regexes are Java regexes, matched like `String.matches` in the generated tests.
  const regex = javaFullMatchRegex(pattern, { dotAll: false });
  return regex !== null && regex.test(String(value));
}

/**
 * Match a value by type (any value of the same type passes), as the generated test's
 * `isInstanceOf`: lists, objects, strings, numbers and booleans are distinct types.
 */
export function byType(value: unknown, expected: unknown): boolean {
  if (value === null || value === undefined) {
    return false;
  }
  if (expected === null || expected === undefined) {
    return false;
  }
  if (Array.isArray(value) || Array.isArray(expected)) {
    return Array.isArray(value) && Array.isArray(expected);
  }
  return typeof value === typeof expected;
}

/** Match a value by strict equality. */
export function byEquality(value: unknown, expected: unknown): boolean {
  return isDeepStrictEqual(value, expected);
}
