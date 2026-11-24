import { evaluateJsonPath, javaFullMatchRegex } from "@stubborn-sh/stub-server";
import { missingDefinitePrefix } from "./jayway-document.js";
import { javaNumberText } from "./json-body.js";
import { ISO_DATE, ISO_DATE_TIME, ISO_TIME, predefinedPattern } from "./predefined-patterns.js";

/**
 * A JS stand-in for the base-class method a `by_command` matcher calls on the JVM (e.g.
 * `assertThatIdIsPositive($it)`). It receives the value the JVM test would pass for `$it`;
 * throw, or return false, to fail the check.
 */
export type CommandHandler = (value: unknown) => boolean | undefined | void;

/** Commands by method name (`assertThatIdIsPositive`) or by the full command text. */
export type Commands = Readonly<Record<string, CommandHandler>>;

/** A response body matcher as written in the YAML contract (`response.matchers.body[]`). */
export interface BodyMatcherSpec {
  readonly path?: string;
  readonly type?: string;
  readonly value?: unknown;
  readonly predefined?: string;
  readonly minOccurrence?: number;
  readonly maxOccurrence?: number;
}

/** A failed matcher. */
export interface MatcherFailure {
  readonly expected: string;
  readonly actual: string;
}

/** Maximum regex pattern length to prevent ReDoS. */
const MAX_REGEX_LENGTH = 1000;

/** Outcome of compiling a matcher's Java regex. */
type Compiled = { readonly regex: RegExp } | { readonly error: string };

/**
 * The Java regex a matcher checks against, as `YamlToContracts.mapResponseBodyMatchers` builds
 * it: `by_regex` takes `predefined` over `value`; `by_date`, `by_time` and `by_timestamp` are the
 * ISO patterns of `BodyMatchers.byDate()` & co.
 */
export function matcherPattern(spec: BodyMatcherSpec): string | { readonly error: string } {
  switch (spec.type) {
    case "by_date":
      return ISO_DATE;
    case "by_time":
      return ISO_TIME;
    case "by_timestamp":
      return ISO_DATE_TIME;
    default:
      if (spec.predefined !== undefined) {
        return (
          predefinedPattern(spec.predefined) ?? {
            error: `unknown predefined regex "${spec.predefined}"`,
          }
        );
      }
      if (typeof spec.value === "string") return spec.value;
      return { error: "by_regex needs a value or a predefined regex" };
  }
}

/** Compile a contract's Java regex for `String.matches` (whole value, no DOTALL). */
export function compileJavaRegex(pattern: string): Compiled {
  if (pattern.length > MAX_REGEX_LENGTH) {
    return { error: `regex longer than ${String(MAX_REGEX_LENGTH)} characters` };
  }
  const regex = javaFullMatchRegex(pattern, { dotAll: false });
  return regex === null
    ? { error: `Java regex ${JSON.stringify(pattern)} cannot be reproduced in JavaScript` }
    : { regex };
}

const COMMAND_CALL = /^\s*([A-Za-z_$][\w$]*)\s*\(\s*\$it\s*\)\s*;?\s*$/;

/**
 * Run a `by_command` (or header/cookie `command`). The JVM test inlines the command with `$it`
 * replaced by the value and runs it as Java code in the base class
 * (`JsonBodyVerificationBuilder.methodForCommandExecution`); the JS verifier cannot run that, so
 * it calls the handler registered under the full command text or, for `method($it)`, the method
 * name.
 */
export function runCommand(
  command: string,
  value: unknown,
  commands: Commands | undefined,
): MatcherFailure | undefined {
  const method = COMMAND_CALL.exec(command)?.[1];
  const handler =
    (commands !== undefined && Object.hasOwn(commands, command) ? commands[command] : undefined) ??
    (method !== undefined && commands !== undefined && Object.hasOwn(commands, method)
      ? commands[method]
      : undefined);
  if (handler === undefined) {
    return {
      expected: `command ${command}`,
      actual:
        `not run: on the JVM this command is Java code in the test base class; register a JS ` +
        `handler for "${method ?? command}" in the verifier's \`commands\` option`,
    };
  }
  try {
    return handler(value) === false
      ? { expected: `command ${command}`, actual: `returned false for ${stringify(value)}` }
      : undefined;
  } catch (err: unknown) {
    return {
      expected: `command ${command}`,
      actual: `threw for ${stringify(value)}: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/** What `parsedJson.read(path)` gives: a value, a list for an indefinite path, or an error. */
type Read =
  | { readonly ok: true; readonly definite: boolean; readonly value: unknown }
  | { readonly ok: false; readonly error: string };

function read(root: unknown, path: string): Read {
  let result: ReturnType<typeof evaluateJsonPath>;
  try {
    result = evaluateJsonPath(root, path);
  } catch (err: unknown) {
    return {
      ok: false,
      error: `invalid JSONPath: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
  if (result.definite) {
    // Jayway: "No results for path" (PathNotFoundException)
    if (result.values.length === 0) return { ok: false, error: "(missing)" };
    return { ok: true, definite: true, value: result.values[0] };
  }
  if (missingDefinitePrefix(root, path)) return { ok: false, error: "(missing)" };
  return { ok: true, definite: false, value: [...result.values] };
}

/** `[*]` or `..` in the path: the JVM then checks every selected element (`arrayRelated`). */
function arrayRelated(path: string): boolean {
  return path.includes("[*]") || path.includes("..");
}

/**
 * Check one body matcher that has a path, as the JVM-generated test does
 * (`JsonBodyVerificationBuilder` / `BodyMethodGeneration.addBodyMatchingBlock`). `contractBody`
 * is the contract's body before matcher-covered entries were removed.
 */
export function checkBodyMatcher(
  spec: BodyMatcherSpec & { readonly path: string },
  actualBody: unknown,
  contractBody: unknown,
  commands: Commands | undefined,
): MatcherFailure | undefined {
  const { path } = spec;
  const type = spec.type ?? "";

  if (type === "by_null") {
    // assertThat((Object) parsedJson.read(path)).isNull()
    const got = read(actualBody, path);
    if (!got.ok) return { expected: "null", actual: got.error };
    if (got.definite && got.value === null) return undefined;
    return { expected: "null", actual: stringify(got.value) };
  }

  if (type === "by_command") {
    if (typeof spec.value !== "string") {
      return { expected: "by_command", actual: "by_command needs a value" };
    }
    const got = read(actualBody, path);
    if (!got.ok) return { expected: `command ${spec.value}`, actual: got.error };
    return runCommand(spec.value, got.value, commands);
  }

  if (type === "by_regex" || type === "by_date" || type === "by_time" || type === "by_timestamp") {
    const pattern = matcherPattern(spec);
    if (typeof pattern !== "string") return { expected: type, actual: pattern.error };
    const compiled = compileJavaRegex(pattern);
    const expected = `${type}(${pattern})`;
    if ("error" in compiled) return { expected, actual: compiled.error };
    return checkRegex(path, compiled.regex, actualBody, expected);
  }

  if (type === "by_equality" || type === "by_type") {
    // Both take the expected value from the contract body; the JVM generator fails on a path
    // the contract body does not have.
    const reference = read(contractBody, path);
    if (!reference.ok || reference.value === null || reference.value === undefined) {
      return {
        expected: type,
        actual: `the contract body has no value at ${path} to take the expected ${type === "by_type" ? "type" : "value"} from`,
      };
    }
    return type === "by_equality"
      ? checkEquality(path, reference.value, actualBody)
      : checkType(spec, reference.value, actualBody);
  }

  return { expected: type, actual: `unsupported body matcher type "${type}"` };
}

/**
 * Regex matchers. On a `[*]`/`..` path the JVM asserts
 * `assertThat((Iterable) parsedJson.read(path, Collection.class)).allElementsMatch(regex)`:
 * the selection must be non-empty and every element's `toString()` must match. Otherwise it
 * asserts `assertThat(parsedJson.read(path, String.class)).matches(regex)`: Jayway turns numbers
 * and booleans into their text, and objects, lists and null into null, which fails.
 */
function checkRegex(
  path: string,
  regex: RegExp,
  actualBody: unknown,
  expected: string,
): MatcherFailure | undefined {
  const got = read(actualBody, path);
  if (!got.ok) return { expected, actual: got.error };
  if (arrayRelated(path)) {
    const values = got.value as unknown[];
    if (values.length === 0) return { expected, actual: "no values selected" };
    const bad = values.find((v) => v === null || !regex.test(javaToString(v)));
    return bad === undefined ? undefined : { expected, actual: stringify(bad) };
  }
  if (!got.definite) {
    return {
      expected,
      actual:
        `${stringify(got.value)} (the path selects a list but has no [*] or ..; ` +
        `the JVM test reads it as a single String, which is null)`,
    };
  }
  const text = asJavaString(got.value);
  return text !== null && regex.test(text) ? undefined : { expected, actual: stringify(got.value) };
}

/**
 * `assertThat(parsedJson.read(path, <class of the contract value>)).isEqualTo(contractValue)`.
 * Jayway converts the response value to the contract value's class first: a number read as a
 * String is its text, a String read as an Integer is parsed, a decimal read as an Integer is
 * truncated.
 */
function checkEquality(
  path: string,
  want: unknown,
  actualBody: unknown,
): MatcherFailure | undefined {
  const expected = `by_equality(${stringify(want)})`;
  const got = read(actualBody, path);
  if (!got.ok) return { expected, actual: got.error };
  const fail = { expected, actual: stringify(got.value) };
  const value = got.value;
  if (typeof want === "string") return asJavaString(value) === want ? undefined : fail;
  if (typeof want === "number") {
    const integral = Number.isInteger(want);
    let number: number | undefined;
    if (typeof value === "number") number = integral ? Math.trunc(value) : value;
    else if (typeof value === "string" && value.trim() !== "") {
      const parsed = Number(value);
      if (!Number.isNaN(parsed) && (!integral || Number.isInteger(parsed))) number = parsed;
    }
    return number === want ? undefined : fail;
  }
  if (typeof want === "boolean") return value === want ? undefined : fail;
  return isDeepEqual(value, want) ? undefined : fail;
}

/**
 * `assertThat((Object) parsedJson.read(path)).isInstanceOf(<class of the contract value>)`,
 * where lists are `List` and objects `Map` (`ClassVerifier.classToCheck`). On an indefinite path
 * both sides read as a list, so only the list is checked, not its elements. With
 * `minOccurrence`/`maxOccurrence` the size of `parsedJson.read(path, Collection.class)` is then
 * checked — flattened (`hasFlattenedSize…`) on a `[*]`/`..` path.
 */
function checkType(
  spec: BodyMatcherSpec & { readonly path: string },
  want: unknown,
  actualBody: unknown,
): MatcherFailure | undefined {
  const wantType = javaType(want);
  const expected = `by_type(${wantType})`;
  const got = read(actualBody, spec.path);
  if (!got.ok) return { expected, actual: got.error };
  const gotType = got.value === null ? "null" : javaType(got.value);
  if (gotType !== wantType) return { expected, actual: `${gotType} ${stringify(got.value)}` };

  const { minOccurrence: min, maxOccurrence: max } = spec;
  if (min === undefined && max === undefined) return undefined;
  const bounds =
    min !== undefined && max !== undefined
      ? `between ${String(min)} and ${String(max)}`
      : min !== undefined
        ? `>= ${String(min)}`
        : `<= ${String(max)}`;
  const sizeExpected = `size ${bounds}`;
  if (!Array.isArray(got.value)) {
    return { expected: sizeExpected, actual: `not a collection: ${stringify(got.value)}` };
  }
  const count = arrayRelated(spec.path) ? flattenedSize(got.value) : got.value.length;
  const ok = (min === undefined || count >= min) && (max === undefined || count <= max);
  return ok ? undefined : { expected: sizeExpected, actual: `size ${String(count)}` };
}

/** `CollectionAssert.flattenedSize`: lists are walked, an object counts its entries. */
function flattenedSize(value: unknown): number {
  if (Array.isArray(value)) return value.reduce((n: number, v) => n + flattenedSize(v), 0);
  if (typeof value === "object" && value !== null) return Object.keys(value).length;
  return 1;
}

/**
 * The Java class family a JSON value reads as. The JVM also tells Integer, Long and Double
 * apart; JavaScript cannot (`1.0` parses as 1), so all numbers are one family here.
 */
function javaType(value: unknown): string {
  if (Array.isArray(value)) return "List";
  if (typeof value === "object" && value !== null) return "Map";
  if (typeof value === "string") return "String";
  if (typeof value === "number") return "Number";
  if (typeof value === "boolean") return "Boolean";
  return "null";
}

/** Jayway `read(path, String.class)`: scalars as text, anything else as null. */
function asJavaString(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (typeof value === "number") return javaNumberText(value);
  if (typeof value === "boolean") return String(value);
  return null;
}

/** `Object.toString()` of a value Jayway read, as `allElementsMatch` matches it. */
function javaToString(value: unknown): string {
  return asJavaString(value) ?? stringify(value);
}

function isDeepEqual(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((v, i) => isDeepEqual(v, b[i]));
  }
  if (isObject(a) && isObject(b)) {
    const keys = Object.keys(a);
    return (
      keys.length === Object.keys(b).length &&
      keys.every((k) => Object.hasOwn(b, k) && isDeepEqual(a[k], b[k]))
    );
  }
  return a === b;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringify(value: unknown): string {
  return JSON.stringify(value) ?? "undefined";
}
