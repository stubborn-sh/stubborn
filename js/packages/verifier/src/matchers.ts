import { isDeepStrictEqual } from "node:util";
import { javaFullMatchRegex } from "@stubborn-sh/stub-server";

/** Maximum regex pattern length to prevent ReDoS. */
const MAX_REGEX_LENGTH = 1000;

/** Match a value against a regex pattern. */
export function byRegex(value: unknown, pattern: string): boolean {
  if (typeof value !== "string" && typeof value !== "number") {
    return false;
  }
  if (pattern.length > MAX_REGEX_LENGTH) {
    return false;
  }
  // Contract regexes are Java regexes, matched like `String.matches` in the generated tests.
  const regex = javaFullMatchRegex(pattern, { dotAll: false });
  return regex !== null && regex.test(String(value));
}

/** Match a value by type (any value of the same type passes). */
export function byType(value: unknown, expected: unknown): boolean {
  if (value === null || value === undefined) {
    return false;
  }
  if (expected === null || expected === undefined) {
    return false;
  }
  return typeof value === typeof expected;
}

/** Match a value by strict equality. */
export function byEquality(value: unknown, expected: unknown): boolean {
  return isDeepStrictEqual(value, expected);
}
