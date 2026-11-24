import { isDeepStrictEqual } from "node:util";
import { evaluateJsonPath, matchesJsonPath } from "./json-path.js";

/**
 * Request matching with WireMock 3 semantics for mappings loaded from WireMock JSON.
 *
 * Supports `method` (including `ANY`), `url`, `urlPath`, `urlPattern`, `urlPathPattern`,
 * `headers`, `queryParameters`, `cookies`, `basicAuthCredentials` and `bodyPatterns`, with the
 * matchers `equalTo` (+ `caseInsensitive`), `contains`, `doesNotContain`, `matches`,
 * `doesNotMatch`, `absent`, `and`, `or`, `equalToJson` (+ `ignoreArrayOrder`,
 * `ignoreExtraElements`, `${json-unit.*}` placeholders) and `matchesJsonPath` (string or
 * `{ expression, <matcher> }`).
 *
 * Anything else (XML/XPath, binary, date-time, multi-value and multipart patterns, custom
 * matchers…) is reported by {@link compileRequestPattern} as unsupported, and a mapping that uses
 * it never matches: silently ignoring a matcher would serve the stub to requests WireMock rejects.
 */

/** The incoming request, as WireMock sees it. */
export interface IncomingRequest {
  readonly method: string;
  /** Path and query string exactly as sent (still percent-encoded). */
  readonly url: string;
  /** Header values by name (any case). */
  readonly headers: Readonly<Record<string, string | readonly string[] | undefined>>;
  /** Raw request body ("" when there is none). */
  readonly body: string;
}

/** A compiled WireMock request pattern. */
export interface CompiledRequestPattern {
  /** Matchers this implementation cannot evaluate (empty when everything is supported). */
  readonly unsupported: readonly string[];
  matches(request: IncomingRequest): boolean;
}

type ValueMatcher = (value: string | undefined) => boolean;
type RequestMatcher = (request: ParsedRequest) => boolean;

interface ParsedRequest {
  readonly method: string;
  readonly url: string;
  readonly path: string;
  readonly query: ReadonlyMap<string, readonly string[]>;
  readonly headers: ReadonlyMap<string, readonly string[]>;
  readonly cookies: ReadonlyMap<string, readonly string[]>;
  readonly body: string;
  json(): unknown;
}

const NOT_JSON: unique symbol = Symbol("not-json");

const compiledCache = new WeakMap<object, CompiledRequestPattern>();

/** {@link compileRequestPattern}, cached per mapping object. */
export function compiledRequestPattern(
  raw: Readonly<Record<string, unknown>>,
): CompiledRequestPattern {
  let compiled = compiledCache.get(raw);
  if (compiled === undefined) {
    compiled = compileRequestPattern(raw);
    compiledCache.set(raw, compiled);
  }
  return compiled;
}

/** Compile a WireMock mapping's `request` object. Never throws for unsupported matchers. */
export function compileRequestPattern(
  raw: Readonly<Record<string, unknown>>,
): CompiledRequestPattern {
  const unsupported: string[] = [];
  const checks: RequestMatcher[] = [];

  const method = typeof raw["method"] === "string" ? raw["method"].toUpperCase() : "ANY";
  if (method !== "ANY") checks.push((r) => r.method === method);

  compileUrl(raw, checks);

  for (const [field, source] of [
    ["headers", (r: ParsedRequest) => r.headers],
    ["queryParameters", (r: ParsedRequest) => r.query],
    ["cookies", (r: ParsedRequest) => r.cookies],
  ] as const) {
    const spec = raw[field];
    if (spec === undefined) continue;
    if (!isRecord(spec)) {
      unsupported.push(`${field} (not an object)`);
      continue;
    }
    for (const [name, matcherSpec] of Object.entries(spec)) {
      const matcher = compileValueMatcher(matcherSpec, `${field}.${name}`, unsupported);
      const key = field === "headers" ? name.toLowerCase() : name;
      checks.push((r) => matchesAnyValue(matcher, source(r).get(key)));
    }
  }

  const basicAuth = raw["basicAuthCredentials"];
  if (basicAuth !== undefined) {
    if (
      isRecord(basicAuth) &&
      typeof basicAuth["username"] === "string" &&
      typeof basicAuth["password"] === "string"
    ) {
      const expected = `Basic ${Buffer.from(`${basicAuth["username"]}:${basicAuth["password"]}`).toString("base64")}`;
      checks.push((r) => (r.headers.get("authorization") ?? []).includes(expected));
    } else {
      unsupported.push("basicAuthCredentials");
    }
  }

  const bodyPatterns = raw["bodyPatterns"];
  if (bodyPatterns !== undefined) {
    if (Array.isArray(bodyPatterns)) {
      for (const [i, pattern] of bodyPatterns.entries()) {
        const matcher = compileBodyMatcher(pattern, `bodyPatterns[${i}]`, unsupported);
        checks.push((r) => matcher(r));
      }
    } else {
      unsupported.push("bodyPatterns (not an array)");
    }
  }

  for (const key of Object.keys(raw)) {
    if (!SUPPORTED_REQUEST_KEYS.has(key)) unsupported.push(key);
  }

  return {
    unsupported,
    matches(request: IncomingRequest): boolean {
      if (unsupported.length > 0) return false;
      const parsed = parseRequest(request);
      return checks.every((check) => check(parsed));
    },
  };
}

const SUPPORTED_REQUEST_KEYS = new Set([
  "method",
  "url",
  "urlPath",
  "urlPattern",
  "urlPathPattern",
  "headers",
  "queryParameters",
  "cookies",
  "basicAuthCredentials",
  "bodyPatterns",
]);

function compileUrl(raw: Readonly<Record<string, unknown>>, checks: RequestMatcher[]): void {
  const { url, urlPath, urlPattern, urlPathPattern } = raw;
  if (typeof url === "string") {
    const expected = stripEmptyQuery(url);
    checks.push((r) => r.url === expected);
  } else if (typeof urlPath === "string") {
    checks.push((r) => r.path === urlPath);
  } else if (typeof urlPattern === "string") {
    const regex = fullMatchRegex(urlPattern);
    checks.push((r) => regex?.test(r.url) === true);
  } else if (typeof urlPathPattern === "string") {
    const regex = fullMatchRegex(urlPathPattern);
    checks.push((r) => regex?.test(r.path) === true);
  }
  // No URL at all: WireMock matches any URL.
}

/** A multi-valued field matches when any value does; a missing field is evaluated as `undefined`. */
function matchesAnyValue(matcher: ValueMatcher, values: readonly string[] | undefined): boolean {
  if (values === undefined || values.length === 0) return matcher(undefined);
  return values.some((value) => matcher(value));
}

const NEGATIVE_KEYS = new Set(["doesNotContain", "doesNotMatch"]);

function compileValueMatcher(spec: unknown, where: string, unsupported: string[]): ValueMatcher {
  if (!isRecord(spec)) {
    unsupported.push(`${where} (not a matcher object)`);
    return () => false;
  }
  if ("absent" in spec) {
    // WireMock treats any `absent` key as "must be absent", whatever its value.
    return (value) => value === undefined;
  }
  if (Array.isArray(spec["and"]) || Array.isArray(spec["or"])) {
    const isAnd = Array.isArray(spec["and"]);
    const parts = ((isAnd ? spec["and"] : spec["or"]) as unknown[]).map((part, i) =>
      compileValueMatcher(part, `${where}.${isAnd ? "and" : "or"}[${i}]`, unsupported),
    );
    return isAnd ? (value) => parts.every((p) => p(value)) : (value) => parts.some((p) => p(value));
  }

  const caseInsensitive = spec["caseInsensitive"] === true;
  const key = Object.keys(spec).find((k) => k !== "caseInsensitive" && !JSON_OPTION_KEYS.has(k));
  const operand = key === undefined ? undefined : spec[key];
  const onMissing = key !== undefined && NEGATIVE_KEYS.has(key);
  const present = (test: (value: string) => boolean): ValueMatcher => {
    return (value) => (value === undefined ? onMissing : test(value));
  };

  switch (key) {
    case "equalTo":
      if (typeof operand !== "string") break;
      return caseInsensitive
        ? present((v) => v.toLowerCase() === operand.toLowerCase())
        : present((v) => v === operand);
    case "contains":
      if (typeof operand !== "string") break;
      return present((v) => v.includes(operand));
    case "doesNotContain":
      if (typeof operand !== "string") break;
      return present((v) => !v.includes(operand));
    case "matches":
    case "doesNotMatch": {
      if (typeof operand !== "string") break;
      const regex = fullMatchRegex(operand);
      if (regex === null) {
        unsupported.push(`${where}.${key} (regex JavaScript cannot compile: ${operand})`);
        return () => false;
      }
      return key === "matches" ? present((v) => regex.test(v)) : present((v) => !regex.test(v));
    }
    case "equalToJson": {
      const expected = parseExpectedJson(operand);
      if (expected === NOT_JSON) break;
      const options = jsonOptions(spec);
      return present((v) => {
        const actual = parseJson(v);
        return actual !== NOT_JSON && jsonEquals(expected, actual, options);
      });
    }
    case "matchesJsonPath": {
      const matcher = compileJsonPathMatcher(spec, where, unsupported);
      return present((v) => matcher(parseJson(v)));
    }
    default:
      break;
  }
  unsupported.push(`${where}.${key ?? "(empty matcher)"}`);
  return () => false;
}

function compileBodyMatcher(spec: unknown, where: string, unsupported: string[]): RequestMatcher {
  if (isRecord(spec) && "absent" in spec) {
    return (r) => r.body === "";
  }
  if (isRecord(spec) && "matchesJsonPath" in spec) {
    const matcher = compileJsonPathMatcher(spec, where, unsupported);
    return (r) => matcher(r.json());
  }
  const matcher = compileValueMatcher(spec, where, unsupported);
  return (r) => matcher(r.body);
}

/** `matchesJsonPath`: a bare expression, or `{ expression, <matcher> }` applied to the selected value. */
function compileJsonPathMatcher(
  spec: Readonly<Record<string, unknown>>,
  where: string,
  unsupported: string[],
): (json: unknown) => boolean {
  const operand = spec["matchesJsonPath"];
  if (typeof operand === "string") {
    return (json) => json !== NOT_JSON && matchesJsonPath(json, operand);
  }
  if (!isRecord(operand) || typeof operand["expression"] !== "string") {
    unsupported.push(`${where}.matchesJsonPath`);
    return () => false;
  }
  const expression = operand["expression"];
  const rest = Object.fromEntries(Object.entries(operand).filter(([k]) => k !== "expression"));
  const valueMatcher = compileValueMatcher(rest, `${where}.matchesJsonPath`, unsupported);
  return (json) => {
    if (json === NOT_JSON) return false;
    let values: readonly unknown[];
    try {
      values = evaluateJsonPath(json, expression).values;
    } catch {
      return false;
    }
    // WireMock applies the matcher to each element of a list result.
    const candidates =
      values.length === 1 && Array.isArray(values[0]) ? (values[0] as unknown[]) : values;
    if (candidates.length === 0 || (candidates.length === 1 && candidates[0] === null)) {
      return valueMatcher(undefined);
    }
    return candidates.some((value) => valueMatcher(jsonPathValueText(value)));
  };
}

function jsonPathValueText(value: unknown): string {
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

// --- equalToJson -------------------------------------------------------------------------------

const JSON_OPTION_KEYS = new Set(["ignoreArrayOrder", "ignoreExtraElements", "serializeAsString"]);

interface JsonOptions {
  readonly ignoreArrayOrder: boolean;
  readonly ignoreExtraElements: boolean;
}

function jsonOptions(spec: Readonly<Record<string, unknown>>): JsonOptions {
  return {
    ignoreArrayOrder: spec["ignoreArrayOrder"] === true,
    ignoreExtraElements: spec["ignoreExtraElements"] === true,
  };
}

const ANY_STRING = "${json-unit.any-string}";
const ANY_NUMBER = "${json-unit.any-number}";
const ANY_BOOLEAN = "${json-unit.any-boolean}";
const IGNORE = "${json-unit.ignore}";
const REGEX_PREFIX = "${json-unit.regex}";

/** JSON comparison as WireMock does it (json-unit): numbers by value, placeholders honoured. */
function jsonEquals(expected: unknown, actual: unknown, options: JsonOptions): boolean {
  if (typeof expected === "string") {
    if (expected === IGNORE) return true;
    if (expected === ANY_STRING) return typeof actual === "string";
    if (expected === ANY_NUMBER) return typeof actual === "number";
    if (expected === ANY_BOOLEAN) return typeof actual === "boolean";
    if (expected.startsWith(REGEX_PREFIX)) {
      const regex = fullMatchRegex(expected.slice(REGEX_PREFIX.length));
      return typeof actual === "string" && regex?.test(actual) === true;
    }
    return expected === actual;
  }
  if (Array.isArray(expected)) {
    if (!Array.isArray(actual)) return false;
    return arraysEqual(expected, actual, options);
  }
  if (isRecord(expected)) {
    if (!isRecord(actual)) return false;
    for (const [key, value] of Object.entries(expected)) {
      if (!Object.hasOwn(actual, key)) return false;
      if (!jsonEquals(value, actual[key], options)) return false;
    }
    return (
      options.ignoreExtraElements ||
      Object.keys(actual).every((key) => Object.hasOwn(expected, key))
    );
  }
  return isDeepStrictEqual(expected, actual);
}

function arraysEqual(
  expected: readonly unknown[],
  actual: readonly unknown[],
  options: JsonOptions,
): boolean {
  if (
    options.ignoreExtraElements
      ? actual.length < expected.length
      : actual.length !== expected.length
  ) {
    return false;
  }
  if (!options.ignoreArrayOrder) {
    // Extra elements are only tolerated after the expected ones.
    return expected.every((value, i) => jsonEquals(value, actual[i], options));
  }
  // Order-insensitive: find a distinct actual element for every expected one (backtracking).
  const used = new Array<boolean>(actual.length).fill(false);
  const assign = (i: number): boolean => {
    if (i === expected.length) return true;
    for (let j = 0; j < actual.length; j++) {
      if (used[j] !== true && jsonEquals(expected[i], actual[j], options)) {
        used[j] = true;
        if (assign(i + 1)) return true;
        used[j] = false;
      }
    }
    return false;
  };
  return assign(0);
}

// --- request parsing ---------------------------------------------------------------------------

function parseRequest(request: IncomingRequest): ParsedRequest {
  const url = stripEmptyQuery(request.url);
  const queryStart = url.indexOf("?");
  const path = queryStart === -1 ? url : url.slice(0, queryStart);

  const query = new Map<string, string[]>();
  for (const [key, value] of new URLSearchParams(
    queryStart === -1 ? "" : url.slice(queryStart + 1),
  )) {
    query.set(key, [...(query.get(key) ?? []), value]);
  }

  const headers = new Map<string, string[]>();
  for (const [name, value] of Object.entries(request.headers)) {
    if (value === undefined) continue;
    const key = name.toLowerCase();
    headers.set(key, [
      ...(headers.get(key) ?? []),
      ...(typeof value === "string" ? [value] : value),
    ]);
  }

  const cookies = new Map<string, string[]>();
  for (const header of headers.get("cookie") ?? []) {
    for (const pair of header.split(";")) {
      const eq = pair.indexOf("=");
      if (eq === -1) continue;
      const name = pair.slice(0, eq).trim();
      cookies.set(name, [...(cookies.get(name) ?? []), pair.slice(eq + 1).trim()]);
    }
  }

  let json: unknown;
  let parsed = false;
  return {
    method: request.method.toUpperCase(),
    url,
    path,
    query,
    headers,
    cookies,
    body: request.body,
    json(): unknown {
      if (!parsed) {
        json = parseJson(request.body);
        parsed = true;
      }
      return json;
    },
  };
}

function stripEmptyQuery(url: string): string {
  return url.endsWith("?") ? url.slice(0, -1) : url;
}

function parseJson(text: string | undefined): unknown {
  if (text === undefined || text.trim() === "") return NOT_JSON;
  try {
    return JSON.parse(text);
  } catch {
    return NOT_JSON;
  }
}

function parseExpectedJson(operand: unknown): unknown {
  if (typeof operand === "string") return parseJson(operand);
  return operand === undefined ? NOT_JSON : operand;
}

/** Java `Pattern.compile(regex, DOTALL).matcher(value).matches()`, as WireMock uses. */
function fullMatchRegex(pattern: string): RegExp | null {
  try {
    return new RegExp(`^(?:${pattern})$`, "s");
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
