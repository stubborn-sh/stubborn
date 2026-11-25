import type { ParsedContract } from "@stubborn-sh/stub-server";
import {
  checkBodyMatcher,
  compileJavaRegex,
  runCommand,
  type BodyMatcherSpec,
  type Commands,
  type MatcherFailure,
} from "./body-matchers.js";
import {
  buildJsonAssertions,
  checkJsonAssertion,
  reducedToEmpty,
  removeMatchingJsonPaths,
} from "./json-body.js";
import { predefinedPattern } from "./predefined-patterns.js";
import { record, section, type ExecutionResult } from "./request-executor.js";

/** Validation failure detail. */
export interface ValidationFailure {
  readonly field: string;
  readonly expected: string;
  readonly actual: string;
}

/** Result of validating a response against a contract. */
export interface ValidationResult {
  readonly valid: boolean;
  readonly contractName: string;
  readonly failures: readonly ValidationFailure[];
}

/** Options for {@link validateResponse}. */
export interface ValidationOptions {
  /**
   * JS stand-ins for the test base-class methods that `by_command` matchers and header/cookie
   * `command`s call on the JVM, by method name (`assertThatIdIsPositive`) or full command text.
   * A command without a handler fails, naming the handler to register.
   */
  readonly commands?: Commands;
}

/**
 * Validate an actual HTTP response against a contract's expected response, with the checks the
 * JVM-generated contract test makes: the status; each contract header and cookie, by equality or
 * by its test matcher (`matchers.headers`/`matchers.cookies`); and the body — a JSON body field
 * by field with its `matchers.body`, other bodies as text or bytes.
 */
export function validateResponse(
  contract: ParsedContract,
  actual: ExecutionResult,
  options?: ValidationOptions,
): ValidationResult {
  const failures: ValidationFailure[] = [];
  const raw = section(contract.source, "response");
  const matchers = record(raw?.["matchers"]);
  const commands = options?.commands;

  if (actual.status !== contract.response.status) {
    failures.push({
      field: "status",
      expected: String(contract.response.status),
      actual: String(actual.status),
    });
  }

  // RestAssuredHeadersThen: one assertion per contract header; a matcher for a header the
  // contract does not list is not used.
  const headers = record(raw?.["headers"]) ?? contract.response.headers ?? {};
  const headerMatchers = keyedMatchers(matchers?.["headers"]);
  for (const [name, value] of Object.entries(headers)) {
    const matcher = headerMatchers.get(name);
    const got = findHeader(actual.headers, name);
    for (const expectedValue of Array.isArray(value) ? (value as unknown[]) : [value]) {
      const failure = checkValue(expectedValue, matcher, got, commands, true);
      if (failure !== undefined) failures.push({ field: `header[${name}]`, ...failure });
    }
  }

  // RestAssuredCookiesThen: `assertThat(response.cookie(k)).isNotNull()`, then the value.
  const cookies = record(raw?.["cookies"]) ?? {};
  const cookieMatchers = keyedMatchers(matchers?.["cookies"]);
  const actualCookies = actual.cookies ?? {};
  for (const [name, value] of Object.entries(cookies)) {
    const got = Object.hasOwn(actualCookies, name) ? actualCookies[name] : undefined;
    const failure = checkValue(value, cookieMatchers.get(name), got, commands, false);
    if (failure !== undefined) failures.push({ field: `cookie[${name}]`, ...failure });
  }

  failures.push(...validateBody(contract, raw, matchers, actual, commands));

  return {
    valid: failures.length === 0,
    contractName: contract.name,
    failures,
  };
}

interface ValueMatcher {
  readonly regex?: unknown;
  readonly predefined?: unknown;
  readonly command?: unknown;
}

function keyedMatchers(list: unknown): Map<string, ValueMatcher> {
  const map = new Map<string, ValueMatcher>();
  if (!Array.isArray(list)) return map;
  for (const item of list) {
    const matcher = record(item);
    const key = matcher?.["key"];
    if (matcher !== undefined && typeof key === "string" && !map.has(key)) map.set(key, matcher);
  }
  return map;
}

/**
 * One header or cookie assertion (`YamlToContracts.serverValue`/`serverCookieValue`): a `regex`
 * or `predefined` matcher makes it `matches(regex)`, a `command` runs the command on the value,
 * otherwise it is `isEqualTo(value)`. A response header holding several values (`a, b`, as
 * fetch joins them) passes when the whole or one of the values does.
 */
function checkValue(
  expected: unknown,
  matcher: ValueMatcher | undefined,
  got: string | undefined,
  commands: Commands | undefined,
  splitList: boolean,
): MatcherFailure | undefined {
  if (typeof matcher?.command === "string") return runCommand(matcher.command, got, commands);
  const candidates = got === undefined ? [] : splitList ? [got, ...got.split(/,\s*/)] : [got];
  const pattern =
    typeof matcher?.regex === "string"
      ? matcher.regex
      : typeof matcher?.predefined === "string"
        ? (predefinedPattern(matcher.predefined) ?? {
            error: `unknown predefined regex "${matcher.predefined}"`,
          })
        : undefined;
  if (pattern !== undefined) {
    if (typeof pattern !== "string")
      return { expected: "a predefined regex", actual: pattern.error };
    const compiled = compileJavaRegex(pattern);
    if ("error" in compiled) return { expected: `matches ${pattern}`, actual: compiled.error };
    return candidates.some((c) => compiled.regex.test(c))
      ? undefined
      : { expected: `matches ${pattern}`, actual: got ?? "(missing)" };
  }
  const want = scalarText(expected);
  return candidates.includes(want) ? undefined : { expected: want, actual: got ?? "(missing)" };
}

function findHeader(headers: Readonly<Record<string, string>>, name: string): string | undefined {
  const lower = name.toLowerCase();
  return Object.entries(headers).find(([k]) => k.toLowerCase() === lower)?.[1];
}

type ContentKind = "json" | "xml" | "text";

/**
 * The body checks. Which ones run follows the generator: `GenericBinaryBodyThen` for
 * `bodyFromFileAsBytes`, `GenericJsonBodyThen` for a JSON body or a `bodyFromFile`,
 * `GenericTextBodyThen` otherwise (XML is compared as text here; the JVM's XPath assertions are
 * not ported). No body in the contract means no body checks, matchers included.
 */
function validateBody(
  contract: ParsedContract,
  raw: Record<string, unknown> | undefined,
  matchers: Record<string, unknown> | undefined,
  actual: ExecutionResult,
  commands: Commands | undefined,
): ValidationFailure[] {
  const actualText =
    actual.bodyText ??
    (typeof actual.body === "string" ? actual.body : (JSON.stringify(actual.body) ?? ""));

  const bytesPath = raw?.["bodyFromFileAsBytes"];
  if (typeof bytesPath === "string") {
    const want = contract.files?.get(bytesPath);
    if (want === undefined) {
      return [
        {
          field: "body",
          expected: `file ${bytesPath}`,
          actual: "file not found next to the contract",
        },
      ];
    }
    const got = actual.bodyBytes ?? new TextEncoder().encode(actualText);
    return sameBytes(got, want)
      ? []
      : [
          {
            field: "body",
            expected: `the ${String(want.length)} bytes of ${bytesPath}`,
            actual: `${String(got.length)} bytes that differ`,
          },
        ];
  }

  let expected: unknown;
  let kind: ContentKind;
  const filePath = raw?.["bodyFromFile"];
  if (typeof filePath === "string") {
    const content = contract.files?.get(filePath);
    if (content === undefined) {
      return [
        {
          field: "body",
          expected: `file ${filePath}`,
          actual: "file not found next to the contract",
        },
      ];
    }
    expected = new TextDecoder().decode(content);
    kind = "json";
  } else {
    expected = raw !== undefined && "body" in raw ? raw["body"] : contract.response.body;
    if (expected === undefined || expected === null) return [];
    kind = contentKind(raw ?? { headers: contract.response.headers }, expected);
  }

  const specs = bodyMatcherSpecs(contract, matchers);
  const pathSpecs = specs.filter(
    (m): m is BodyMatcherSpec & { path: string } => m.path !== undefined,
  );
  if (kind === "xml" && pathSpecs.length > 0) {
    // YamlToContracts registers these as xPath matchers for an XML body.
    return [
      {
        field: "body",
        expected: `XPath matchers ${pathSpecs.map((m) => m.path).join(", ")}`,
        actual: "not supported by the JS verifier (the JVM checks an XML body with XPath)",
      },
    ];
  }

  // YamlToContracts.mapResponseBody: a path-less by_regex / by_command matcher stands for the
  // whole body; matchers with a path still run (BodyMethodGeneration.addBodyMatchingBlock).
  const whole = specs.find(
    (m) => m.path === undefined && (m.type === "by_regex" || m.type === "by_command"),
  );
  const failures: ValidationFailure[] =
    whole !== undefined ? wholeBody(whole, actualText, actual, commands) : [];

  if (kind !== "json") {
    if (whole !== undefined) return failures;
    // assertThat(responseBody).isEqualTo(…)
    const want = typeof expected === "string" ? expected : (JSON.stringify(expected) ?? "");
    return actualText === want ? [] : [{ field: "body", expected: want, actual: actualText }];
  }

  // JSON: a string body is parsed when it is JSON; a scalar is then checked as text.
  const json = typeof expected === "string" ? (parseJson(expected) ?? expected) : expected;
  let reduced: unknown = undefined;
  if (whole === undefined) {
    reduced = removeMatchingJsonPaths(
      json,
      pathSpecs.map((m) => m.path),
    );
    if (!Array.isArray(reduced) && !isObject(reduced)) {
      const want = typeof reduced === "string" ? reduced : String(reduced);
      return actualText === want ? [] : [{ field: "body", expected: want, actual: actualText }];
    }
  } else if (pathSpecs.length === 0) {
    return failures;
  }

  const parsedActual =
    actual.bodyText !== undefined
      ? parseJson(actual.bodyText)
      : typeof actual.body === "string"
        ? parseJson(actual.body)
        : actual.body;
  if (parsedActual === undefined) {
    // JsonPath.parse(response body) throws: nothing else can be checked.
    failures.push({
      field: "body",
      expected: "a JSON body",
      actual: actualText === "" ? "(empty)" : actualText,
    });
    return failures;
  }
  const assertions =
    whole === undefined ? buildJsonAssertions(reduced, !reducedToEmpty(json, reduced)) : [];
  for (const assertion of assertions) {
    const failure = checkJsonAssertion(parsedActual, assertion);
    if (failure !== undefined) {
      failures.push({
        field: `body${failure.path}`,
        expected: failure.expected,
        actual: failure.actual,
      });
    }
  }
  for (const spec of pathSpecs) {
    const failure = checkBodyMatcher(spec, parsedActual, json, commands);
    if (failure !== undefined) failures.push({ field: `body${spec.path}`, ...failure });
  }
  return failures;
}

/** A path-less body matcher: `matches(regex)` on, or the command run with, the whole body. */
function wholeBody(
  spec: BodyMatcherSpec,
  actualText: string,
  actual: ExecutionResult,
  commands: Commands | undefined,
): ValidationFailure[] {
  if (typeof spec.value !== "string") {
    return [{ field: "body", expected: spec.type ?? "", actual: "the body matcher needs a value" }];
  }
  let failure: MatcherFailure | undefined;
  if (spec.type === "by_command") {
    failure = runCommand(spec.value, actual.body, commands);
  } else {
    const compiled = compileJavaRegex(spec.value);
    failure =
      "error" in compiled
        ? { expected: `matches ${spec.value}`, actual: compiled.error }
        : compiled.regex.test(actualText)
          ? undefined
          : { expected: `matches ${spec.value}`, actual: actualText };
  }
  return failure === undefined ? [] : [{ field: "body", ...failure }];
}

/** The body matchers, from the YAML document (all types) or, without one, the parsed contract. */
function bodyMatcherSpecs(
  contract: ParsedContract,
  matchers: Record<string, unknown> | undefined,
): BodyMatcherSpec[] {
  const list = matchers?.["body"];
  if (Array.isArray(list)) {
    return list.flatMap((item) => {
      const m = record(item);
      if (m === undefined) return [];
      return [
        {
          ...(typeof m["path"] === "string" ? { path: m["path"] } : {}),
          ...(typeof m["type"] === "string" ? { type: m["type"] } : {}),
          ...(m["value"] !== undefined && m["value"] !== null ? { value: m["value"] } : {}),
          ...(typeof m["predefined"] === "string" ? { predefined: m["predefined"] } : {}),
          ...(typeof m["minOccurrence"] === "number" ? { minOccurrence: m["minOccurrence"] } : {}),
          ...(typeof m["maxOccurrence"] === "number" ? { maxOccurrence: m["maxOccurrence"] } : {}),
        },
      ];
    });
  }
  return (contract.response.matchers?.body ?? []).map((m) => ({ ...m }));
}

/**
 * `ContentUtils.recognizeContentTypeFromHeader` (the `Content-Type` or `contentType` header,
 * case as written): json → JSON, xml → XML, text/form → text; another value is used only when the
 * body evaluates to JSON; without one the body's shape decides (`getClientContentType`): an
 * object, a list, a number or a string holding JSON is JSON, a string starting with `<` is XML.
 * A structured body is always checked as JSON (the JVM would compare its `toString()` as text).
 */
function contentKind(raw: Record<string, unknown>, body: unknown): ContentKind {
  const headers = record(raw["headers"]) ?? {};
  const header = headers["Content-Type"] ?? headers["contentType"];
  const contentType = typeof header === "string" ? header : "";
  if (contentType.includes("json")) return "json";
  if (contentType.includes("xml")) return "xml";
  if (Array.isArray(body) || isObject(body)) return "json";
  if (contentType.includes("text") || contentType.includes("form-urlencoded")) return "text";
  if (typeof body !== "string") return "json";
  if (parseJson(body) !== undefined) return "json";
  return body.trimStart().startsWith("<") && contentType === "" ? "xml" : "text";
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

function scalarText(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value) ?? "";
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
