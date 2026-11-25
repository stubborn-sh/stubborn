import {
  DslProperty,
  ExecutionProperty,
  FromFileProperty,
  IDENTITY,
  JSON_PARSING,
  MatchingStrategy,
  NamedProperty,
  patternText,
  sideValues,
  stubSideValues,
  toClientValues,
  transformValues,
  type MatchingStrategyType,
} from "./contract-dsl.js";
import {
  hashMapOrder,
  isJavaNumber,
  jacksonWrite,
  javaStringHash,
  javaToString,
  JavaDouble,
  JavaInt,
  JavaPattern,
  patternQuote,
  tryJacksonRead,
  unescapeEcmaScript,
} from "./java-values.js";
import { javaFullMatchRegex } from "./java-regex.js";
import { evaluateJsonPath, jsonPathLocations, JsonPathSyntaxError } from "./json-path.js";
import { stubSideJsonPaths } from "./json-to-json-paths.js";
import { PREDEFINED_PATTERNS, ISO_DATE, ISO_DATE_TIME, ISO_TIME } from "./predefined-patterns.js";
import { loadYamlDocuments } from "./snake-yaml.js";
import { parseXmlDocument } from "./xml-matcher.js";
import { removeMatchingXPaths, xmlEqualities, xPathString } from "./xml-to-xpaths.js";

/**
 * A port of the JVM's YAML → WireMock stub conversion: `YamlToContracts` (YAML → contract DSL)
 * followed by `DslToWireMockClientConverter` (`WireMockStubStrategy`, `WireMockRequestStubStrategy`,
 * `WireMockResponseStubStrategy`, `BaseWireMockStubStrategy`). The result is the WireMock mapping
 * the JVM writes for the contract, without its random `id`/`uuid`.
 *
 * Values are handled as the JVM holds them (see `java-values.ts`): a document loaded by
 * {@link loadYamlDocuments} keeps SnakeYAML's types (`1.0` stays a `Double`, `yes` is `true`); a
 * plain document (such as `ParsedContract.source`) is turned into Java values first, integral
 * numbers becoming `Integer`/`Long` and the others `Double`.
 */

/** A WireMock mapping as JSON (`request`, `response`, `priority`). */
export type WireMockMappingJson = Record<string, unknown>;

/** Options for {@link yamlContractToWireMock}. */
export interface YamlToWireMockOptions {
  /**
   * The files the contract references (`bodyFromFile`, `bodyFromFileAsBytes`,
   * `fileContentFromFileAsBytes`), by the path written in the contract.
   */
  readonly files?: ReadonlyMap<string, Uint8Array>;
}

/** The JVM fails to convert the contract (its build would fail too). */
export class YamlConversionError extends Error {}

/**
 * The WireMock mapping the JVM generates for one YAML contract (a document, or one element of a
 * document that is a list), or `undefined` when it generates none (an `ignored` contract, or a
 * messaging contract without a `request`). Throws {@link YamlConversionError} when the JVM rejects
 * the contract.
 */
export function yamlContractToWireMock(
  contract: unknown,
  options?: YamlToWireMockOptions,
): WireMockMappingJson | undefined {
  const value = contract instanceof Map ? contract : toJavaValue(contract);
  if (!(value instanceof Map)) throw new YamlConversionError("A contract must be a YAML mapping");
  const yamlContract = readContract(value as Map<string, unknown>);
  return new StubConverter(yamlContract, options?.files ?? new Map()).mapping();
}

/**
 * Loads YAML text as the JVM's converter does (SnakeYAML, then Jackson): one entry per contract,
 * a document that is a list giving one per element. `null` documents are skipped.
 */
export function loadYamlContracts(
  text: string,
): { readonly document: number; readonly contract: unknown }[] {
  const out: { document: number; contract: unknown }[] = [];
  loadYamlDocuments(text)
    .filter((d) => d !== null && d !== undefined)
    .forEach((document, index) => {
      for (const item of Array.isArray(document) ? document : [document]) {
        out.push({ document: index, contract: item });
      }
    });
  return out;
}

/** A plain JavaScript value (as js-yaml or JSON.parse give it) as the JVM would hold it. */
export function toJavaValue(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") {
    return Number.isInteger(value) && Math.abs(value) <= Number.MAX_SAFE_INTEGER
      ? JavaInt.of(BigInt(value))
      : new JavaDouble(value);
  }
  if (typeof value === "bigint") return JavaInt.of(value);
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Uint8Array || value instanceof Map) return value;
  if (Array.isArray(value)) return value.map(toJavaValue);
  if (typeof value === "object") {
    return new Map(Object.entries(value).map(([k, v]) => [k, toJavaValue(v)]));
  }
  return value;
}

// =============================================================================================
// YamlContract: the document as Jackson's convertValue reads it into the JVM's `YamlContract`
// (FAIL_ON_UNKNOWN_PROPERTIES enabled).
// =============================================================================================

type JMap = Map<string, unknown>;

interface KeyValueMatcher {
  readonly key: string | null;
  readonly regex: string | null;
  readonly predefined: string | null;
  readonly command: string | null;
}

interface BodyMatcherDef {
  readonly path: string | null;
  readonly type: string | null;
  readonly value: string | null;
  readonly predefined: string | null;
  readonly minOccurrence: number | null;
  readonly maxOccurrence: number | null;
}

interface QueryParameterMatcher {
  readonly key: string | null;
  readonly type: string | null;
  readonly value: unknown;
}

interface ValueMatcher {
  readonly regex: string | null;
  readonly predefined: string | null;
}

interface NamedMatcher {
  readonly paramName: string | null;
  readonly fileName: ValueMatcher | null;
  readonly fileContent: ValueMatcher | null;
  readonly contentType: ValueMatcher | null;
}

interface StubMatchers {
  readonly url: KeyValueMatcher | null;
  readonly body: readonly BodyMatcherDef[] | null;
  readonly headers: readonly KeyValueMatcher[] | null;
  readonly queryParameters: readonly QueryParameterMatcher[] | null;
  readonly cookies: readonly KeyValueMatcher[] | null;
  readonly multipart: {
    readonly params: readonly KeyValueMatcher[] | null;
    readonly named: readonly NamedMatcher[] | null;
  } | null;
}

interface NamedPart {
  readonly paramName: string | null;
  readonly fileName: string | null;
  readonly fileContent: string | null;
  readonly fileContentAsBytes: string | null;
  readonly fileContentFromFileAsBytes: string | null;
  readonly contentType: string | null;
  readonly fileNameCommand: string | null;
  readonly fileContentCommand: string | null;
  readonly contentTypeCommand: string | null;
}

interface YamlRequest {
  readonly method: string | null;
  readonly url: string | null;
  readonly urlPath: string | null;
  readonly queryParameters: JMap | null;
  readonly headers: JMap | null;
  readonly cookies: JMap | null;
  readonly body: unknown;
  readonly bodyFromFile: string | null;
  readonly bodyFromFileAsBytes: string | null;
  readonly matchers: StubMatchers | null;
  readonly multipart: {
    readonly params: Map<string, string | null> | null;
    readonly named: readonly NamedPart[] | null;
  } | null;
}

interface TestMatchers {
  readonly body: readonly BodyMatcherDef[] | null;
  readonly headers: readonly KeyValueMatcher[] | null;
  readonly cookies: readonly KeyValueMatcher[] | null;
}

interface YamlResponse {
  readonly status: number | null;
  readonly headers: JMap | null;
  readonly cookies: JMap | null;
  readonly body: unknown;
  readonly bodyFromFile: string | null;
  readonly bodyFromFileAsBytes: string | null;
  readonly matchers: TestMatchers | null;
  readonly fixedDelayMilliseconds: number | null;
}

interface YamlContract {
  readonly request: YamlRequest | null;
  readonly response: YamlResponse | null;
  readonly priority: number | null;
  readonly ignored: boolean;
  readonly metadata: JMap | null;
}

const PREDEFINED = Object.keys(PREDEFINED_PATTERNS);
const STUB_MATCHER_TYPES = [
  "by_date",
  "by_time",
  "by_timestamp",
  "by_regex",
  "by_equality",
  "by_type",
  "by_null",
];
const TEST_MATCHER_TYPES = [
  "by_date",
  "by_time",
  "by_timestamp",
  "by_regex",
  "by_equality",
  "by_type",
  "by_command",
  "by_null",
];
const MATCHING_TYPES = [
  "equal_to",
  "containing",
  "matching",
  "not_matching",
  "equal_to_json",
  "equal_to_xml",
  "absent",
  "binary_equal_to",
];
const REGEX_TYPES = [
  "as_integer",
  "as_double",
  "as_float",
  "as_long",
  "as_short",
  "as_boolean",
  "as_string",
];

class Reader {
  constructor(
    readonly where: string,
    private readonly map: JMap,
  ) {}

  static of(value: unknown, where: string, allowed: readonly string[]): Reader | null {
    if (value === null || value === undefined) return null;
    if (!(value instanceof Map)) {
      throw new YamlConversionError(`${where} must be a YAML mapping, not ${javaToString(value)}`);
    }
    for (const key of (value as JMap).keys()) {
      if (!allowed.includes(key)) {
        throw new YamlConversionError(`Unrecognized property "${key}" in ${where}`);
      }
    }
    return new Reader(where, value as JMap);
  }

  has(key: string): boolean {
    return this.map.has(key);
  }

  raw(key: string): unknown {
    const value = this.map.get(key);
    return value === undefined ? null : value;
  }

  string(key: string): string | null {
    return jacksonString(this.raw(key), `${this.where}.${key}`);
  }

  int(key: string): number | null {
    const value = this.raw(key);
    if (value === null) return null;
    if (value instanceof JavaInt && value.type === "Integer") return Number(value.value);
    if (value instanceof JavaDouble && Number.isFinite(value.value)) return Math.trunc(value.value);
    if (typeof value === "string" && /^[-+]?\d+$/.test(value.trim())) {
      const n = Number(value.trim());
      if (n >= -(2 ** 31) && n < 2 ** 31) return n;
    }
    throw new YamlConversionError(
      `${this.where}.${key} must be an integer, not ${javaToString(value)}`,
    );
  }

  boolean(key: string): boolean {
    const value = this.raw(key);
    if (value === null) return false;
    if (typeof value === "boolean") return value;
    if (value === "true" || value === "false") return value === "true";
    throw new YamlConversionError(
      `${this.where}.${key} must be a boolean, not ${javaToString(value)}`,
    );
  }

  enumValue(key: string, values: readonly string[]): string | null {
    const value = this.raw(key);
    if (value === null) return null;
    if (typeof value === "string" && values.includes(value)) return value;
    if (value instanceof JavaInt && value.value >= 0n && value.value < BigInt(values.length)) {
      return values[Number(value.value)] ?? null;
    }
    throw new YamlConversionError(
      `${this.where}.${key}: "${javaToString(value)}" is not one of ${values.join(", ")}`,
    );
  }

  /** A `Map<String, Object>` field with a default of an empty map. */
  mapField(key: string): JMap | null {
    if (!this.has(key)) return new Map();
    const value = this.raw(key);
    if (value === null) return null;
    if (!(value instanceof Map)) {
      throw new YamlConversionError(`${this.where}.${key} must be a YAML mapping`);
    }
    return value as JMap;
  }

  /** A `List<…>` field with a default of an empty list. */
  list<T>(key: string, read: (item: unknown, where: string) => T): T[] | null {
    if (!this.has(key)) return [];
    const value = this.raw(key);
    if (value === null) return null;
    if (!Array.isArray(value)) throw new YamlConversionError(`${this.where}.${key} must be a list`);
    return value.map((item, i) => read(item, `${this.where}.${key}[${i}]`));
  }
}

function jacksonString(value: unknown, where: string): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value;
  if (typeof value === "boolean" || isJavaNumber(value)) return javaToString(value);
  if (value instanceof Uint8Array) return Buffer.from(value).toString("base64");
  throw new YamlConversionError(`${where} must be a text value, not ${javaToString(value)}`);
}

function readKeyValueMatcher(value: unknown, where: string): KeyValueMatcher {
  const r = Reader.of(value, where, ["key", "regex", "predefined", "command", "regexType"]);
  r?.enumValue("regexType", REGEX_TYPES);
  return {
    key: r?.string("key") ?? null,
    regex: r?.string("regex") ?? null,
    predefined: r?.enumValue("predefined", PREDEFINED) ?? null,
    command: r?.string("command") ?? null,
  };
}

function readBodyMatcher(value: unknown, where: string, types: readonly string[]): BodyMatcherDef {
  const r = Reader.of(value, where, [
    "path",
    "type",
    "value",
    "predefined",
    "minOccurrence",
    "maxOccurrence",
    "regexType",
  ]);
  r?.enumValue("regexType", REGEX_TYPES);
  return {
    path: r?.string("path") ?? null,
    type: r?.enumValue("type", types) ?? null,
    value: r?.string("value") ?? null,
    predefined: r?.enumValue("predefined", PREDEFINED) ?? null,
    minOccurrence: r?.int("minOccurrence") ?? null,
    maxOccurrence: r?.int("maxOccurrence") ?? null,
  };
}

function readValueMatcher(value: unknown, where: string): ValueMatcher | null {
  const r = Reader.of(value, where, ["regex", "predefined"]);
  if (r === null) return null;
  return { regex: r.string("regex"), predefined: r.enumValue("predefined", PREDEFINED) };
}

function readStubMatchers(value: unknown, where: string): StubMatchers | null {
  const r = Reader.of(value, where, [
    "url",
    "body",
    "headers",
    "queryParameters",
    "cookies",
    "multipart",
  ]);
  if (r === null) return null;
  const multipart = Reader.of(r.raw("multipart"), `${where}.multipart`, ["params", "named"]);
  return {
    url: r.raw("url") === null ? null : readKeyValueMatcher(r.raw("url"), `${where}.url`),
    body: r.list("body", (v, w) => readBodyMatcher(v, w, STUB_MATCHER_TYPES)),
    headers: r.list("headers", readKeyValueMatcher),
    queryParameters: r.list("queryParameters", (v, w) => {
      const q = Reader.of(v, w, ["key", "type", "value"]);
      return {
        key: q?.string("key") ?? null,
        type: q?.enumValue("type", MATCHING_TYPES) ?? null,
        value: q?.raw("value") ?? null,
      };
    }),
    cookies: r.list("cookies", readKeyValueMatcher),
    multipart:
      multipart === null
        ? null
        : {
            params: multipart.list("params", readKeyValueMatcher),
            named: multipart.list("named", (v, w) => {
              const n = Reader.of(v, w, ["paramName", "fileName", "fileContent", "contentType"]);
              return {
                paramName: n?.string("paramName") ?? null,
                fileName: readValueMatcher(n?.raw("fileName") ?? null, `${w}.fileName`),
                fileContent: readValueMatcher(n?.raw("fileContent") ?? null, `${w}.fileContent`),
                contentType: readValueMatcher(n?.raw("contentType") ?? null, `${w}.contentType`),
              };
            }),
          },
  };
}

const DEFAULT_STUB_MATCHERS: StubMatchers = {
  url: null,
  body: [],
  headers: [],
  queryParameters: [],
  cookies: [],
  multipart: null,
};

const DEFAULT_TEST_MATCHERS: TestMatchers = { body: [], headers: [], cookies: [] };

function readTestMatchers(value: unknown, where: string): TestMatchers | null {
  const r = Reader.of(value, where, ["body", "headers", "cookies"]);
  if (r === null) return null;
  const testHeader = (v: unknown, w: string): KeyValueMatcher => {
    const h = Reader.of(v, w, ["key", "regex", "command", "predefined", "regexType"]);
    h?.enumValue("regexType", REGEX_TYPES);
    return {
      key: h?.string("key") ?? null,
      regex: h?.string("regex") ?? null,
      predefined: h?.enumValue("predefined", PREDEFINED) ?? null,
      command: h?.string("command") ?? null,
    };
  };
  return {
    body: r.list("body", (v, w) => readBodyMatcher(v, w, TEST_MATCHER_TYPES)),
    headers: r.list("headers", testHeader),
    cookies: r.list("cookies", testHeader),
  };
}

function readRequest(value: unknown): YamlRequest | null {
  const r = Reader.of(value, "request", [
    "method",
    "url",
    "urlPath",
    "queryParameters",
    "headers",
    "cookies",
    "body",
    "bodyFromFile",
    "bodyFromFileAsBytes",
    "matchers",
    "multipart",
  ]);
  if (r === null) return null;
  const multipart = Reader.of(r.raw("multipart"), "request.multipart", ["params", "named"]);
  let params: Map<string, string | null> | null = null;
  if (multipart !== null) {
    const raw = multipart.mapField("params");
    params =
      raw === null
        ? null
        : new Map([...raw].map(([k, v]) => [k, jacksonString(v, `request.multipart.params.${k}`)]));
  }
  return {
    method: r.string("method"),
    url: r.string("url"),
    urlPath: r.string("urlPath"),
    queryParameters: r.mapField("queryParameters"),
    headers: r.mapField("headers"),
    cookies: r.mapField("cookies"),
    body: r.raw("body"),
    bodyFromFile: r.string("bodyFromFile"),
    bodyFromFileAsBytes: r.string("bodyFromFileAsBytes"),
    matchers: r.has("matchers")
      ? readStubMatchers(r.raw("matchers"), "request.matchers")
      : DEFAULT_STUB_MATCHERS,
    multipart:
      multipart === null
        ? null
        : {
            params,
            named: multipart.list("named", (v, w) => {
              const n = Reader.of(v, w, [
                "paramName",
                "fileName",
                "fileContent",
                "fileContentAsBytes",
                "fileContentFromFileAsBytes",
                "contentType",
                "fileNameCommand",
                "fileContentCommand",
                "contentTypeCommand",
              ]);
              return {
                paramName: n?.string("paramName") ?? null,
                fileName: n?.string("fileName") ?? null,
                fileContent: n?.string("fileContent") ?? null,
                fileContentAsBytes: n?.string("fileContentAsBytes") ?? null,
                fileContentFromFileAsBytes: n?.string("fileContentFromFileAsBytes") ?? null,
                contentType: n?.string("contentType") ?? null,
                fileNameCommand: n?.string("fileNameCommand") ?? null,
                fileContentCommand: n?.string("fileContentCommand") ?? null,
                contentTypeCommand: n?.string("contentTypeCommand") ?? null,
              };
            }),
          },
  };
}

function readResponse(value: unknown): YamlResponse | null {
  const r = Reader.of(value, "response", [
    "status",
    "headers",
    "cookies",
    "body",
    "bodyFromFile",
    "bodyFromFileAsBytes",
    "matchers",
    "async",
    "fixedDelayMilliseconds",
  ]);
  if (r === null) return null;
  const async = r.raw("async");
  if (async !== null && typeof async !== "boolean" && async !== "true" && async !== "false") {
    throw new YamlConversionError(`response.async must be a boolean, not ${javaToString(async)}`);
  }
  return {
    status: r.int("status"),
    headers: r.mapField("headers"),
    cookies: r.mapField("cookies"),
    body: r.raw("body"),
    bodyFromFile: r.string("bodyFromFile"),
    bodyFromFileAsBytes: r.string("bodyFromFileAsBytes"),
    matchers: r.has("matchers")
      ? readTestMatchers(r.raw("matchers"), "response.matchers")
      : DEFAULT_TEST_MATCHERS,
    fixedDelayMilliseconds: r.int("fixedDelayMilliseconds"),
  };
}

function readContract(value: JMap): YamlContract {
  const r = Reader.of(value, "the contract", [
    "request",
    "response",
    "input",
    "outputMessage",
    "description",
    "label",
    "name",
    "priority",
    "ignored",
    "inProgress",
    "metadata",
  ]) as Reader;
  r.string("description");
  r.string("label");
  r.string("name");
  r.boolean("inProgress");
  const input = Reader.of(r.raw("input"), "input", ["triggeredBy", "assertThat"]);
  input?.string("triggeredBy");
  input?.string("assertThat");
  const output = Reader.of(r.raw("outputMessage"), "outputMessage", [
    "sentTo",
    "headers",
    "body",
    "bodyFromFile",
    "bodyFromFileAsBytes",
    "assertThat",
    "matchers",
  ]);
  output?.mapField("headers");
  if (output?.has("matchers") === true)
    readTestMatchers(output.raw("matchers"), "outputMessage.matchers");
  return {
    request: readRequest(r.raw("request")),
    response: readResponse(r.raw("response")),
    priority: r.int("priority"),
    ignored: r.boolean("ignored"),
    metadata: r.mapField("metadata"),
  };
}

// =============================================================================================
// DefaultWireMockStubPostProcessor: `metadata.wiremock.stubMapping` merged into the stub.
// =============================================================================================

/** The `Fault` enum. */
const FAULT_NAMES = [
  "EMPTY_RESPONSE",
  "MALFORMED_RESPONSE_CHUNK",
  "RANDOM_DATA_THEN_CLOSE",
  "CONNECTION_RESET_BY_PEER",
];

/**
 * `DefaultWireMockStubPostProcessor`, which the JVM applies when the contract's metadata has a
 * `wiremock` entry whose `stubMapping` is a string (JSON) or a map: the stub's response takes the
 * delay, fault, proxy and transformer settings of that stub mapping's response (and loses the
 * stub-side `removeProxyRequestHeaders` default, written as `[]`), and its `postServeActions` and
 * `metadata` are added. The JVM rejects an ignored contract with such metadata.
 */
function postProcessStubMapping(
  mapping: WireMockMappingJson | undefined,
  metadata: JMap | null,
): WireMockMappingJson | undefined {
  if (metadata === null || !metadata.has("wiremock")) return mapping;
  const wiremock = metadata.get("wiremock");
  if (wiremock !== null && !(wiremock instanceof Map)) {
    throw new YamlConversionError("metadata.wiremock must be a mapping");
  }
  const stub = wiremock === null ? null : ((wiremock as JMap).get("stubMapping") ?? null);
  if (stub === null)
    throw new YamlConversionError("metadata.wiremock.stubMapping must not be null");
  // WireMockMetaData.APPLICABLE_CLASSES: String, StubMapping, Map.
  if (typeof stub !== "string" && !(stub instanceof Map)) return mapping;
  if (mapping === undefined)
    throw new YamlConversionError("Cannot post process a null stub mapping");

  const text = typeof stub === "string" ? stub : jacksonWrite(stub);
  const parsed = tryJacksonRead(text)?.value;
  if (!(parsed instanceof Map)) {
    throw new YamlConversionError(`metadata.wiremock.stubMapping is not a WireMock stub: ${text}`);
  }
  const fromMetadata = parsed as JMap;
  // Unknown properties are ignored (WireMock's mapper does not fail on them); the request
  // patterns are dropped by the merge, so only their shape is checked.
  for (const key of ["request", "newRequest"]) {
    const value = fromMetadata.get(key);
    if (value !== undefined && value !== null && !(value instanceof Map)) {
      throw new YamlConversionError(`metadata.wiremock.stubMapping.${key} must be an object`);
    }
  }
  const metaResponse = fromMetadata.get("response") ?? null;
  if (metaResponse !== null && !(metaResponse instanceof Map)) {
    throw new YamlConversionError("metadata.wiremock.stubMapping.response must be an object");
  }
  // Without a response, StubMapping.getResponse() is ResponseDefinition.ok(), whose empty
  // transformers replace the stub's.
  const meta: JMap =
    metaResponse === null
      ? new Map<string, unknown>([
          ["transformers", []],
          ["transformerParameters", new Map()],
        ])
      : (metaResponse as JMap);
  const original = mapping["response"] as Record<string, unknown>;
  const pick = <T>(key: string, read: (value: unknown) => T): T | undefined => {
    const value = meta.get(key);
    if (value !== undefined && value !== null) return read(value);
    return original[key] as T | undefined;
  };
  const where = (key: string): string => `metadata.wiremock.stubMapping.response.${key}`;

  // ResponseDefinition's creator order, which Jackson writes it in.
  const response: Record<string, unknown> = { status: original["status"] };
  for (const key of ["body", "base64Body", "headers"]) {
    if (original[key] !== undefined) response[key] = original[key];
  }
  response["removeProxyRequestHeaders"] = [];
  const merged: [string, unknown][] = [
    [
      "fixedDelayMilliseconds",
      pick("fixedDelayMilliseconds", (v) => wireMockInt(v, where("fixedDelayMilliseconds"))),
    ],
    [
      "delayDistribution",
      pick("delayDistribution", (v) => delayDistribution(v, where("delayDistribution"))),
    ],
    [
      "chunkedDribbleDelay",
      pick("chunkedDribbleDelay", (v) => chunkedDribbleDelay(v, where("chunkedDribbleDelay"))),
    ],
    // The ResponseDefinition constructor trims it.
    [
      "proxyBaseUrl",
      pick("proxyBaseUrl", (v) => javaTrim(wireMockString(v, where("proxyBaseUrl")))),
    ],
    [
      "proxyUrlPrefixToRemove",
      pick("proxyUrlPrefixToRemove", (v) => wireMockString(v, where("proxyUrlPrefixToRemove"))),
    ],
    ["fault", pick("fault", (v) => fault(v, where("fault")))],
    ["transformers", pick("transformers", (v) => transformersList(v, where("transformers")))],
    [
      "transformerParameters",
      pick("transformerParameters", (v) => jsonMap(v, where("transformerParameters"))),
    ],
  ];
  for (const [key, value] of merged) {
    if (value === undefined || value === null) continue;
    // @JsonInclude(NON_EMPTY) on the transformers and their parameters.
    if (key === "transformers" && (value as unknown[]).length === 0) continue;
    if (key === "transformerParameters" && Object.keys(value).length === 0) continue;
    response[key] = value;
  }

  const out: WireMockMappingJson = { request: mapping["request"], response };
  if (mapping["priority"] !== undefined) out["priority"] = mapping["priority"];
  // Jackson writes StubMapping's `metadata` before its `postServeActions`.
  const extra = fromMetadata.get("metadata");
  if (extra !== undefined && extra !== null) {
    out["metadata"] = jsonMap(extra, "metadata.wiremock.stubMapping.metadata");
  }
  const actions = fromMetadata.get("postServeActions");
  if (actions !== undefined && actions !== null) {
    const list = postServeActions(actions);
    if (list !== undefined) out["postServeActions"] = list;
  }
  return out;
}

/** A Java value as plain JSON (numbers as JavaScript numbers, maps as objects). */
function plainJson(value: unknown): unknown {
  if (value instanceof JavaInt || value instanceof JavaDouble) return Number(value.value);
  if (value instanceof Map) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of value as Map<unknown, unknown>) out[javaToString(k)] = plainJson(v);
    return out;
  }
  if (Array.isArray(value)) return value.map(plainJson);
  return value;
}

function jsonMap(value: unknown, where: string): Record<string, unknown> {
  if (!(value instanceof Map)) throw new YamlConversionError(`${where} must be an object`);
  return plainJson(value) as Record<string, unknown>;
}

/** Jackson's coercion of a JSON scalar to an `int`/`Integer`. */
function wireMockInt(value: unknown, where: string): number {
  if (value instanceof JavaInt && value.type === "Integer") return Number(value.value);
  if (value instanceof JavaDouble && Number.isFinite(value.value)) {
    const truncated = Math.trunc(value.value);
    if (Math.abs(truncated) < 2 ** 31) return truncated;
  }
  if (typeof value === "string" && /^[+-]?\d+$/.test(value.trim())) {
    const n = Number(value.trim());
    if (Math.abs(n) < 2 ** 31) return n;
  }
  throw new YamlConversionError(`${where} must be an integer: ${javaToString(value)}`);
}

function wireMockNumber(value: unknown, where: string): number {
  if (value instanceof JavaInt || value instanceof JavaDouble) return Number(value.value);
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) {
    return Number(value);
  }
  throw new YamlConversionError(`${where} must be a number: ${javaToString(value)}`);
}

function wireMockString(value: unknown, where: string): string {
  if (typeof value === "string") return value;
  if (value instanceof JavaInt || value instanceof JavaDouble || typeof value === "boolean") {
    return javaToString(value);
  }
  throw new YamlConversionError(`${where} must be a string`);
}

function fault(value: unknown, where: string): string {
  if (typeof value === "string" && FAULT_NAMES.includes(value)) return value;
  throw new YamlConversionError(
    `${where}: "${javaToString(value)}" is not one of ${FAULT_NAMES.join(", ")}`,
  );
}

function transformersList(value: unknown, where: string): string[] {
  if (!Array.isArray(value)) throw new YamlConversionError(`${where} must be a list`);
  return value.map((v, i) => wireMockString(v, `${where}[${i}]`));
}

/** `DelayDistribution`: `type` first, then the subtype's properties in declaration order. */
function delayDistribution(value: unknown, where: string): Record<string, unknown> {
  if (!(value instanceof Map)) throw new YamlConversionError(`${where} must be an object`);
  const map = value as JMap;
  const type = map.get("type");
  const field = (key: string, read: (v: unknown, w: string) => number, optional = false) => {
    const v = map.get(key);
    if (v === undefined || v === null) {
      if (optional) return {};
      // A missing primitive is Jackson's default, 0.
      return { [key]: 0 };
    }
    return { [key]: read(v, `${where}.${key}`) };
  };
  switch (type) {
    case "lognormal":
      return {
        type,
        ...field("median", wireMockNumber),
        ...field("sigma", wireMockNumber),
        ...field("maxValue", wireMockNumber, true),
      };
    case "uniform":
      return { type, ...field("lower", wireMockInt), ...field("upper", wireMockInt) };
    case "fixed":
      return { type, ...field("milliseconds", wireMockNumber) };
    default:
      throw new YamlConversionError(
        `${where}.type: "${javaToString(type)}" is not lognormal, uniform or fixed`,
      );
  }
}

function chunkedDribbleDelay(value: unknown, where: string): Record<string, unknown> {
  if (!(value instanceof Map)) throw new YamlConversionError(`${where} must be an object`);
  const out: Record<string, unknown> = {};
  for (const key of ["numberOfChunks", "totalDuration"]) {
    const v = (value as JMap).get(key);
    if (v !== undefined && v !== null) out[key] = wireMockInt(v, `${where}.${key}`);
  }
  return out;
}

/**
 * `StubMapping.setPostServeActions(Object)`: a map of name to parameters, or a list of
 * `{name, parameters}`; anything else is dropped.
 */
function postServeActions(value: unknown): Record<string, unknown>[] | undefined {
  const where = "metadata.wiremock.stubMapping.postServeActions";
  const definition = (name: unknown, parameters: unknown): Record<string, unknown> => ({
    ...(name !== null && name !== undefined ? { name: wireMockString(name, `${where}.name`) } : {}),
    ...(parameters !== null && parameters !== undefined
      ? { parameters: jsonMap(parameters, `${where}.parameters`) }
      : {}),
  });
  if (value instanceof Map) {
    return [...(value as JMap)].map(([name, parameters]) => definition(name, parameters));
  }
  if (Array.isArray(value)) {
    return value.map((item) => {
      if (!(item instanceof Map)) throw new YamlConversionError(`${where} must hold objects`);
      return definition((item as JMap).get("name"), (item as JMap).get("parameters"));
    });
  }
  return undefined;
}

// =============================================================================================
// The contract DSL pieces the stub strategies read.
// =============================================================================================

/** `MatchingType` of a body matcher. */
type MatchingType =
  "EQUALITY" | "TYPE" | "REGEX" | "DATE" | "TIME" | "TIMESTAMP" | "NULL" | "COMMAND";

interface BodyMatcher {
  readonly path: string;
  readonly type: MatchingType;
  /** The regex (`RegexProperty`), for the regex-like types. */
  readonly value: string | null;
  readonly min: number | null;
  readonly max: number | null;
}

interface Header {
  readonly name: string;
  readonly client: unknown;
  readonly server: unknown;
}

interface QueryParameter {
  readonly name: string;
  readonly client: unknown;
}

interface DslUrl {
  readonly client: unknown;
  readonly queryParameters: readonly QueryParameter[] | null;
}

type ContentType = "JSON" | "XML" | "TEXT" | "FORM" | "DEFINED" | "UNKNOWN";

const WRAPPER = "UNQUOTE_ME";
const TRANSFORMERS = ["response-template", "stubborn-contract"];

class StubConverter {
  private readonly request: YamlRequest | null;
  private readonly response: YamlResponse | null;

  constructor(
    private readonly contract: YamlContract,
    private readonly files: ReadonlyMap<string, Uint8Array>,
  ) {
    this.request = contract.request;
    this.response = contract.response;
  }

  mapping(): WireMockMappingJson | undefined {
    const req = this.request;
    const res = this.response;
    // Response cookies are validated by the JVM even though the stub does not use them.
    if (res !== null) this.responseCookies(res);
    if (req === null) return undefined;
    if (res === null) throw new YamlConversionError("The contract has no response");
    const dsl = this.dslRequest(req);
    const responseDsl = this.dslResponse(res);
    const request = this.buildRequest(req, dsl);
    const response = this.buildResponse(res, responseDsl, dsl);
    const mapping = this.contract.ignored
      ? undefined
      : {
          request,
          response,
          ...(this.contract.priority !== null ? { priority: this.contract.priority } : {}),
        };
    return postProcessStubMapping(mapping, this.contract.metadata);
  }

  // ------------------------------------------------------------------------------------------
  // YamlToContracts: the request
  // ------------------------------------------------------------------------------------------

  private dslRequest(req: YamlRequest): DslRequest {
    const matchers = req.matchers;
    const urlMatcher = matchers?.url ?? null;
    const queryParameters = (): QueryParameter[] | null => {
      if (req.queryParameters === null) return null;
      const out: QueryParameter[] = [];
      for (const [key, value] of req.queryParameters) {
        for (const v of Array.isArray(value) ? value : [value]) {
          out.push(queryParameter(key, this.queryParamValue(req, key, v)));
        }
      }
      return out;
    };
    const url: DslUrl | null =
      req.url !== null
        ? { client: urlValue(req.url, urlMatcher), queryParameters: queryParameters() }
        : null;
    const urlPath: DslUrl | null =
      req.urlPath !== null
        ? { client: urlValue(req.urlPath, urlMatcher), queryParameters: queryParameters() }
        : null;

    const headers: Header[] = [];
    if (req.headers !== null && req.headers.size > 0) {
      for (const [key, value] of req.headers) {
        const keyMatchers = notNull(matchers?.headers, "request.matchers.headers").filter(
          (m) => m.key === key,
        );
        for (const matcher of keyMatchers) {
          if (Array.isArray(value)) {
            for (const v of value) {
              const client = clientValue(v, matcher, key).client;
              if (client === null) throw new YamlConversionError(`Header ${key} has no value`);
              addHeader(headers, header(key, client));
            }
          } else {
            const client = clientValue(value, matcher, key).client;
            addHeader(
              headers,
              header(
                key,
                new DslProperty(
                  client,
                  matcher.command !== null ? new ExecutionProperty(matcher.command) : value,
                ),
              ),
            );
          }
        }
        if (keyMatchers.length === 0) addHeader(headers, header(key, value));
      }
    }

    const cookies: Header[] = [];
    if (req.cookies !== null && req.cookies.size > 0) {
      for (const [key, value] of req.cookies) {
        const matcher =
          notNull(matchers?.cookies, "request.matchers.cookies").find((c) => c.key === key) ?? null;
        cookies.push(header(key, clientValue(value, matcher, key)));
      }
    }

    let body: DslProperty | null = null;
    if (req.body !== null) body = new DslProperty(req.body);
    if (req.bodyFromFile !== null) body = new DslProperty(this.file(req.bodyFromFile));
    if (req.bodyFromFileAsBytes !== null) {
      body = new DslProperty(this.fileAsBytes(req.bodyFromFileAsBytes));
    }

    const multipart = req.multipart !== null ? this.multipart(req) : null;
    const bodyMatchers = this.requestBodyMatchers(req);
    return {
      method: req.method,
      url,
      urlPath,
      headers,
      cookies,
      body,
      multipart,
      bodyMatchers,
    };
  }

  private queryParamValue(req: YamlRequest, key: string, value: unknown): unknown {
    const matcher =
      notNull(req.matchers?.queryParameters, "request.matchers.queryParameters").find(
        (q) => q.key === key,
      ) ?? null;
    if (matcher === null) return value;
    if (matcher.type === null) {
      throw new YamlConversionError("Query parameter matcher type must not be null");
    }
    const types: Record<string, MatchingStrategyType> = {
      equal_to: "EQUAL_TO",
      containing: "CONTAINS",
      matching: "MATCHING",
      not_matching: "NOT_MATCHING",
      equal_to_json: "EQUAL_TO_JSON",
      equal_to_xml: "EQUAL_TO_XML",
    };
    if (matcher.type === "absent")
      return new DslProperty(new MatchingStrategy(true, "ABSENT"), null);
    const type = types[matcher.type];
    if (type === undefined) {
      throw new YamlConversionError(`The provided matching type [${matcher.type}] is unsupported`);
    }
    if (matcher.value === null) {
      throw new YamlConversionError(
        `Query parameter matcher value must not be null for ${matcher.type}`,
      );
    }
    return new DslProperty(new MatchingStrategy(matcher.value, type), value);
  }

  private multipart(req: YamlRequest): Map<string, unknown> {
    const multipart = req.multipart as NonNullable<YamlRequest["multipart"]>;
    const stubMatcher = notNull(req.matchers, "request.matchers").multipart;
    const entries: [string, unknown][] = [];
    for (const [paramKey, paramValue] of notNull(multipart.params, "request.multipart.params")) {
      const matcher =
        stubMatcher !== null
          ? (notNull(stubMatcher.params, "request.matchers.multipart.params").find(
              (p) => p.key === paramKey,
            ) ?? null)
          : null;
      let value: unknown = paramValue;
      if (matcher !== null) {
        value =
          matcher.regex !== null
            ? new JavaPattern(matcher.regex)
            : predefinedToPattern(matcher.predefined);
      }
      entries.push([paramKey, new DslProperty(value, paramValue)]);
    }
    for (const named of notNull(multipart.named, "request.multipart.named")) {
      const matcher =
        stubMatcher !== null
          ? (notNull(stubMatcher.named, "request.matchers.multipart.named").find(
              (m) => m.paramName === named.paramName,
            ) ?? null)
          : null;
      const pattern = (m: ValueMatcher): JavaPattern =>
        m.regex !== null ? new JavaPattern(m.regex) : predefinedToPattern(m.predefined);
      const fileName: unknown =
        matcher?.fileName != null ? pattern(matcher.fileName) : named.fileName;
      const fileContent: unknown =
        matcher?.fileContent != null ? pattern(matcher.fileContent) : named.fileContent;
      const contentType: unknown =
        matcher?.contentType != null ? pattern(matcher.contentType) : named.contentType;
      let contentServer: unknown;
      if (named.fileContent !== null) contentServer = named.fileContent;
      else if (named.fileContentFromFileAsBytes !== null) {
        contentServer = this.fileAsBytes(named.fileContentFromFileAsBytes);
      } else if (named.fileContentAsBytes !== null) {
        contentServer = Buffer.from(named.fileContentAsBytes, "utf-8");
      } else if (named.fileContentCommand !== null) {
        contentServer = new ExecutionProperty(named.fileContentCommand);
      } else {
        throw new YamlConversionError(
          `No file content provided for named multipart parameter: ${String(named.paramName)}`,
        );
      }
      entries.push([
        String(named.paramName),
        new NamedProperty(
          new DslProperty(fileName, named.fileName),
          new DslProperty(fileContent, contentServer),
          new DslProperty(contentType, named.contentType),
        ),
      ]);
    }
    // A HashMap: the JVM iterates it in hash order.
    const unique = new Map<string, unknown>();
    for (const [k, v] of entries) unique.set(k, v);
    return new Map(hashMapOrder([...unique], ([k]) => javaStringHash(k)));
  }

  private requestBodyMatchers(req: YamlRequest): BodyMatcher[] {
    const out: BodyMatcher[] = [];
    const defs = req.matchers?.body;
    if (defs === null || defs === undefined) return out;
    for (const def of defs) {
      if (def.type === null) throw new YamlConversionError("Stub matcher type must not be null");
      const matcher = bodyMatcher(def, false);
      if (matcher !== null) out.push(matcher);
    }
    return out;
  }

  private file(path: string): string {
    const bytes = this.files.get(path);
    if (bytes === undefined) throw new YamlConversionError(`File [${path}] is not present`);
    let text: string;
    try {
      text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      throw new YamlConversionError(`File [${path}] syntax is incorrect`);
    }
    // Files.readAllLines joined with "\n": line terminators normalized, the last one dropped.
    const lines = text.split(/\r\n|\r|\n/);
    if (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
    return lines.join("\n");
  }

  private fileAsBytes(path: string): FromFileProperty {
    const bytes = this.files.get(path);
    if (bytes === undefined) throw new YamlConversionError(`File [${path}] is not present`);
    return new FromFileProperty(bytes, path.split("/").pop() ?? path);
  }

  // ------------------------------------------------------------------------------------------
  // YamlToContracts: the response
  // ------------------------------------------------------------------------------------------

  private dslResponse(res: YamlResponse): DslResponse {
    if (res.status === null) throw new YamlConversionError("response.status is required");
    const headers: Header[] = [];
    if (res.headers !== null) {
      for (const [key, value] of res.headers) {
        const matcher =
          notNull(res.matchers?.headers, "response.matchers.headers").find((h) => h.key === key) ??
          null;
        for (const v of Array.isArray(value) ? value : [value]) {
          addHeader(headers, header(key, new DslProperty(v, serverValue(v, matcher, key))));
        }
      }
    }
    let body: DslProperty | null = null;
    if (res.body !== null) {
      const whole =
        res.matchers?.body?.find(
          (m) => m.path === null && (m.type === "by_regex" || m.type === "by_command"),
        ) ?? null;
      if (whole !== null) {
        if (whole.value === null) {
          throw new YamlConversionError("Body test matcher value must not be null");
        }
        body = new DslProperty(
          res.body,
          whole.type === "by_regex"
            ? new JavaPattern(whole.value)
            : new ExecutionProperty(whole.value),
        );
      } else body = new DslProperty(res.body);
    }
    if (res.bodyFromFile !== null) body = new DslProperty(this.file(res.bodyFromFile));
    if (res.bodyFromFileAsBytes !== null) {
      body = new DslProperty(this.fileAsBytes(res.bodyFromFileAsBytes));
    }
    for (const def of res.matchers?.body ?? []) {
      if (def.type === null)
        throw new YamlConversionError("Body test matcher type must not be null");
      bodyMatcher(def, true);
    }
    return { status: res.status, headers, body, delay: res.fixedDelayMilliseconds };
  }

  private responseCookies(res: YamlResponse): void {
    if (res.cookies === null) return;
    for (const [key, value] of res.cookies) {
      const matcher =
        notNull(res.matchers?.cookies, "response.matchers.cookies").find((c) => c.key === key) ??
        null;
      serverValue(value, matcher, key);
    }
  }

  // ------------------------------------------------------------------------------------------
  // WireMockRequestStubStrategy
  // ------------------------------------------------------------------------------------------

  private buildRequest(req: YamlRequest, dsl: DslRequest): Record<string, unknown> {
    if (dsl.method === null) throw new YamlConversionError("request.method is required");
    const contentType = this.inputContentType(dsl);
    const out: Record<string, unknown> = { ...this.urlPattern(dsl) };
    out["method"] = dsl.method;

    const headers: Record<string, unknown> = {};
    for (const h of dsl.headers)
      headers[h.name] = this.headerPattern(h.name, h.client, contentType);
    if (Object.keys(headers).length > 0) out["headers"] = headers;

    const query = dsl.urlPath?.queryParameters ?? dsl.url?.queryParameters ?? null;
    const queryParameters: Record<string, unknown> = {};
    for (const q of query ?? []) queryParameters[q.name] = valuePattern(q.client, contentType);
    if (Object.keys(queryParameters).length > 0) out["queryParameters"] = queryParameters;

    const cookies: Record<string, unknown> = {};
    for (const c of dsl.cookies) cookies[c.name] = valuePattern(c.client, contentType);
    if (Object.keys(cookies).length > 0) out["cookies"] = cookies;

    const bodyPatterns: unknown[] = [];
    const metadata = this.contract.metadata;
    if (metadata?.has("verifier") === true) {
      throw new YamlConversionError(
        "metadata.verifier: the JVM matches such a contract with its own request matcher",
      );
    }
    this.appendBody(req, dsl, contentType, bodyPatterns);
    this.appendMultipart(dsl, bodyPatterns);
    if (bodyPatterns.length > 0) out["bodyPatterns"] = bodyPatterns;
    return out;
  }

  private urlPattern(dsl: DslRequest): Record<string, unknown> {
    const urlPath =
      dsl.urlPath !== null
        ? dsl.urlPath.client
        : dsl.url?.queryParameters !== null && dsl.url !== null
          ? dsl.url.client
          : null;
    if (urlPath !== null) {
      if (urlPath instanceof JavaPattern)
        return { urlPathPattern: stubSideString(urlPath.pattern) };
      return { urlPath: stubSideString(javaToString(urlPath)) };
    }
    if (dsl.url === null) throw new YamlConversionError("URL is required!");
    const url = dsl.url.client;
    if (url instanceof JavaPattern) return { urlPattern: url.pattern };
    return { url: javaToString(url) };
  }

  private headerPattern(name: string, client: unknown, contentType: ContentType): unknown {
    if (name.toLowerCase() === "content-type" && typeof client === "string") {
      const value = javaTrimLower(client);
      if (value.startsWith("multipart/") && !value.includes("boundary=")) {
        return { matches: `${patternQuote(javaTrim(client))}.*` };
      }
    }
    return valuePattern(client, contentType);
  }

  private inputContentType(dsl: DslRequest): ContentType {
    return evaluateStubContentType(dsl.headers, dsl.body);
  }

  private appendBody(
    req: YamlRequest,
    dsl: DslRequest,
    contentType: ContentType,
    out: unknown[],
  ): void {
    const body = dsl.body;
    if (body === null) return;
    const client = body.client;
    if (client instanceof FromFileProperty && contentType !== "JSON" && contentType !== "XML") {
      out.push({ binaryEqualTo: Buffer.from(client.bytes).toString("base64") });
      return;
    }
    if (contentType === "JSON") {
      if (client instanceof FromFileProperty) {
        throw new YamlConversionError(
          `A JSON file body read as bytes (bodyFromFileAsBytes: ${req.bodyFromFileAsBytes ?? ""}) cannot be matched`,
        );
      }
      const originalBody = toClientValues(client);
      const stripped = removeMatchingJsonPaths(originalBody, dsl.bodyMatchers);
      const values = stubSideJsonPaths(stripped);
      const onlySize =
        values.length > 0 && dsl.bodyMatchers.length === 0 && values.every((v) => v.assertsSize);
      if ((values.length === 0 && dsl.bodyMatchers.length === 0) || onlySize) {
        out.push({
          equalToJson: jacksonWrite(originalBody),
          ignoreArrayOrder: false,
          ignoreExtraElements: false,
        });
      } else {
        for (const v of values) {
          if (!v.assertsSize) out.push(matchingJsonPath(v.jsonPath.replaceAll("\\\\", "\\")));
        }
      }
      for (const matcher of dsl.bodyMatchers) {
        out.push(
          matchingJsonPath(jsonPathForMatcher(matcher, originalBody).replaceAll("\\\\", "\\")),
        );
      }
      return;
    }
    if (contentType === "XML") {
      const originalBody = toClientValues(client);
      const text = javaToString(originalBody);
      const doc = parseXmlDocument(text);
      if (doc === null) throw new YamlConversionError(`The XML body is not well formed: ${text}`);
      removeMatchingXPaths(
        doc,
        dsl.bodyMatchers.map((m) => m.path),
      );
      for (const equality of xmlEqualities(doc)) {
        out.push({ matchesXPath: { expression: equality.xPath, equalTo: equality.value } });
      }
      for (const matcher of dsl.bodyMatchers) {
        out.push(xPathPattern(matcher, text));
      }
      return;
    }
    // MatchingStrategy guessed from the content type (equalTo; FORM bodies joined with `&`).
    out.push(valuePattern(new MatchingStrategy(toClientValues(client), "EQUAL_TO"), contentType));
  }

  private appendMultipart(dsl: DslRequest, out: unknown[]): void {
    if (dsl.multipart === null) return;
    for (const [key, value] of dsl.multipart) {
      if (value instanceof NamedProperty) {
        const name = value.name.client;
        const content = value.value.client;
        if (name === null || name === undefined || content === null || content === undefined) {
          throw new YamlConversionError(`Multipart file ${key} needs a file name and content`);
        }
        const contentType = value.contentType.client ?? ".*";
        out.push({
          matches: multipartFile(
            key,
            javaToString(name),
            javaToString(content),
            javaToString(contentType),
          ),
        });
      } else {
        const v = sideValues(value, true, IDENTITY);
        out.push({ matches: multipartParam(key, javaToString(v)) });
      }
    }
  }

  // ------------------------------------------------------------------------------------------
  // WireMockResponseStubStrategy
  // ------------------------------------------------------------------------------------------

  private buildResponse(
    res: YamlResponse,
    dsl: DslResponse,
    request: DslRequest,
  ): Record<string, unknown> {
    const out: Record<string, unknown> = { status: dsl.status };
    const headers = new Map<string, { name: string; values: string[] }>();
    for (const h of dsl.headers) {
      if (h.client === null || h.client === undefined) {
        throw new YamlConversionError(`Response header ${h.name} has no value`);
      }
      const value = javaToString(stubSideValues(h.client));
      const key = h.name.toLowerCase();
      const entry = headers.get(key);
      if (entry === undefined) headers.set(key, { name: h.name, values: [value] });
      else entry.values.push(value);
    }
    const definedContentType =
      dsl.headers.find((h) => h.name.toLowerCase() === "content-type")?.client ?? null;
    if (dsl.body !== null) {
      const parsing =
        definedContentType !== null && javaToString(definedContentType).includes("/stream")
          ? IDENTITY
          : JSON_PARSING;
      const body = sideValues(dsl.body.client, true, parsing);
      if (body instanceof Uint8Array) out["base64Body"] = Buffer.from(body).toString("base64");
      else if (body instanceof Map) out["body"] = this.parseMapBody(body as JMap, request);
      else if (Array.isArray(body)) out["body"] = parseListBody(body);
      else if (body !== null && body !== undefined) out["body"] = javaToString(body);
    }
    if (headers.size > 0) {
      const json: Record<string, unknown> = {};
      for (const { name, values } of headers.values()) {
        json[name] = values.length === 1 ? values[0] : values;
      }
      out["headers"] = json;
    }
    if (dsl.delay !== null) out["fixedDelayMilliseconds"] = dsl.delay;
    out["transformers"] = [...TRANSFORMERS];
    void res;
    return out;
  }

  /** `BaseWireMockStubStrategy.parseBody(Map)`, with the request-body templating hack. */
  private parseMapBody(map: JMap, request: DslRequest): string {
    let transformed: unknown = stubSideValues(map);
    if (request.body !== null) {
      const testSide = toJson(sideValues(request.body.server, false));
      let context: unknown;
      try {
        context = JSON.parse(testSide);
      } catch {
        context = undefined;
      }
      transformed = transformValues(transformed, (val) => {
        if (typeof val === "string" && containsJsonPathTemplateEntry(val)) {
          const path = jsonPathFromTemplateEntry(val);
          const result = evaluateJsonPath(context, path);
          if (result.definite && result.values.length === 0) throw new Error("PathNotFound");
          const value = result.definite ? result.values[0] : result.values;
          if (typeof value === "string") return val;
          return WRAPPER + val + WRAPPER;
        }
        return val;
      });
    }
    const json = toJson(transformed);
    const unquoted = json.replaceAll(`"${WRAPPER}`, "").replaceAll(`${WRAPPER}"`, " ");
    return unquoted.replaceAll("\\/", "/");
  }
}

interface DslRequest {
  readonly method: string | null;
  readonly url: DslUrl | null;
  readonly urlPath: DslUrl | null;
  readonly headers: readonly Header[];
  readonly cookies: readonly Header[];
  readonly body: DslProperty | null;
  readonly multipart: Map<string, unknown> | null;
  readonly bodyMatchers: readonly BodyMatcher[];
}

interface DslResponse {
  readonly status: number;
  readonly headers: readonly Header[];
  readonly body: DslProperty | null;
  readonly delay: number | null;
}

function notNull<T>(value: T | null | undefined, what: string): T {
  if (value === null || value === undefined) {
    throw new YamlConversionError(`${what} must not be null`);
  }
  return value;
}

/** `Header.build` / `QueryParameter.build`: a `DslProperty` contributes its sides. */
function header(name: string, value: unknown): Header {
  if (value instanceof DslProperty) return { name, client: value.client, server: value.server };
  return { name, client: value, server: value };
}

/**
 * `Headers.header`: the entries are a `LinkedHashSet`, so a header equal to one already there
 * (same name, and `DslProperty.equals` sides) is dropped.
 */
function addHeader(headers: Header[], added: Header): void {
  const duplicate = headers.some(
    (h) =>
      h.name === added.name &&
      javaEquals(patternText(h.client), patternText(added.client)) &&
      javaEquals(patternText(h.server), patternText(added.server)),
  );
  if (!duplicate) headers.push(added);
}

/** `Objects.equals` on the Java values a contract holds. */
function javaEquals(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null || a === undefined || b === undefined) return false;
  if (a instanceof JavaInt) return b instanceof JavaInt && a.type === b.type && a.value === b.value;
  if (a instanceof JavaDouble) return b instanceof JavaDouble && Object.is(a.value, b.value);
  if (a instanceof DslProperty) {
    return (
      b instanceof DslProperty &&
      javaEquals(patternText(a.client), patternText(b.client)) &&
      javaEquals(patternText(a.server), patternText(b.server))
    );
  }
  if (a instanceof ExecutionProperty)
    return b instanceof ExecutionProperty && a.command === b.command;
  if (a instanceof MatchingStrategy) {
    return b instanceof MatchingStrategy && a.type === b.type && javaEquals(a.value, b.value);
  }
  if (Array.isArray(a)) {
    return (
      Array.isArray(b) && a.length === b.length && a.every((item, i) => javaEquals(item, b[i]))
    );
  }
  if (a instanceof Map) {
    if (!(b instanceof Map) || a.size !== b.size) return false;
    for (const [k, v] of a) {
      if (!b.has(k) || !javaEquals(v, b.get(k))) return false;
    }
    return true;
  }
  // A Pattern (without DslProperty's text comparison) and a byte[] are equal only to themselves.
  return false;
}

function queryParameter(name: string, value: unknown): QueryParameter {
  if (value === null || value === undefined) {
    throw new YamlConversionError(`Query parameter '${name}' has no value`);
  }
  return { name, client: value instanceof DslProperty ? value.client : value };
}

function predefinedToPattern(predefined: string | null): JavaPattern {
  if (predefined === null) {
    throw new YamlConversionError(
      "Neither regex nor predefined was set in the matcher; cannot determine pattern",
    );
  }
  return new JavaPattern(PREDEFINED_PATTERNS[predefined] as string);
}

function urlValue(url: string, matcher: KeyValueMatcher | null): unknown {
  if (matcher === null) return url;
  if (matcher.command !== null) return url;
  if (matcher.regex !== null) return new JavaPattern(matcher.regex);
  if (matcher.predefined !== null) return predefinedToPattern(matcher.predefined);
  return url;
}

function assertPatternMatched(pattern: JavaPattern, value: unknown, key: string): void {
  const regex = javaFullMatchRegex(pattern.pattern, { dotAll: false });
  if (regex === null) {
    throw new YamlConversionError(`The regex [${pattern.pattern}] of [${key}] cannot be evaluated`);
  }
  const text = javaToString(value);
  if (!regex.test(text)) {
    throw new YamlConversionError(
      `Broken headers! A header with key [${key}] with value [${text}] is not matched by regex [${pattern.pattern}]`,
    );
  }
}

/** `YamlToContracts.clientValue`. */
function clientValue(value: unknown, matcher: KeyValueMatcher | null, key: string): DslProperty {
  let client = value;
  if (matcher !== null && matcher.regex !== null) {
    client = new JavaPattern(matcher.regex);
    assertPatternMatched(client as JavaPattern, value, key);
  } else if (matcher !== null && matcher.predefined !== null) {
    client = predefinedToPattern(matcher.predefined);
    assertPatternMatched(client as JavaPattern, value, key);
  } else if (matcher !== null && matcher.command !== null) {
    return new DslProperty(value, new ExecutionProperty(matcher.command));
  }
  return new DslProperty(client, value);
}

/** `YamlToContracts.serverValue` (test header / cookie matchers). */
function serverValue(value: unknown, matcher: KeyValueMatcher | null, key: string): unknown {
  if (matcher !== null && matcher.regex !== null) {
    const pattern = new JavaPattern(matcher.regex);
    assertPatternMatched(pattern, value, key);
    return pattern;
  }
  if (matcher !== null && matcher.predefined !== null) {
    const pattern = predefinedToPattern(matcher.predefined);
    assertPatternMatched(pattern, value, key);
    return pattern;
  }
  if (matcher !== null && matcher.command !== null) return new ExecutionProperty(matcher.command);
  return value;
}

/** The body matcher `YamlToContracts` adds for a matcher definition (`null` for `by_null` stubs). */
function bodyMatcher(def: BodyMatcherDef, testSide: boolean): BodyMatcher | null {
  let type: MatchingType;
  let value: string | null = null;
  switch (def.type) {
    case "by_date":
      type = "DATE";
      value = ISO_DATE;
      break;
    case "by_time":
      type = "TIME";
      value = ISO_TIME;
      break;
    case "by_timestamp":
      type = "TIMESTAMP";
      value = ISO_DATE_TIME;
      break;
    case "by_regex":
      type = "REGEX";
      value = def.predefined !== null ? predefinedToPattern(def.predefined).pattern : def.value;
      if (value === null) {
        throw new YamlConversionError(
          "Neither value nor predefined is set for by_regex stub matcher",
        );
      }
      break;
    case "by_equality":
      type = "EQUALITY";
      break;
    case "by_type":
      type = "TYPE";
      break;
    case "by_command":
      type = "COMMAND";
      value = def.value;
      if (value === null)
        throw new YamlConversionError("Body test matcher value must not be null for by_command");
      break;
    case "by_null":
      if (!testSide) return null;
      type = "NULL";
      break;
    default:
      throw new YamlConversionError(`The type [${String(def.type)}] is unsupported`);
  }
  if (def.path === null) {
    if (testSide) return null;
    throw new YamlConversionError("Stub matcher path must not be null");
  }
  return {
    path: def.path,
    type,
    value,
    min: type === "TYPE" ? def.minOccurrence : null,
    max: type === "TYPE" ? def.maxOccurrence : null,
  };
}

// =============================================================================================
// Content types (ContentUtils, SingleContractMetadata)
// =============================================================================================

function isTemplateText(content: string): boolean {
  return (
    (content.includes("{{") && content.includes("}}")) ||
    (content.includes("{{{") && content.includes("}}}"))
  );
}

function contentTypeFromHeader(headers: readonly Header[], side: "client" | "server"): ContentType {
  const header = headers.find((h) => h.name === "Content-Type" || h.name === "contentType");
  if (header === undefined) return "UNKNOWN";
  const value = header[side];
  if (value === null || value === undefined) return "UNKNOWN";
  const content = javaToString(value);
  if (content.includes("json")) return "JSON";
  if (content.includes("xml")) return "XML";
  if (content.includes("text")) return "TEXT";
  if (content.includes("form-urlencoded")) return "FORM";
  if (content.includes("octet-stream")) return "UNKNOWN";
  if (content !== "" && !isTemplateText(content)) return "DEFINED";
  return "UNKNOWN";
}

function contentTypeFromContent(value: unknown): ContentType {
  let object = value;
  if (object instanceof FromFileProperty) {
    if (object.isJson()) return "JSON";
    if (object.isXml()) return "XML";
    object = object.bytes;
  }
  if (object instanceof Map || Array.isArray(object)) return "JSON";
  if (object instanceof Uint8Array) return "UNKNOWN";
  if (typeof object === "string") {
    if (tryJacksonRead(object) !== undefined) return "JSON";
    if (parseXmlDocument(object) !== null) return "XML";
    return "UNKNOWN";
  }
  if (isJavaNumber(object)) return "TEXT";
  return "UNKNOWN";
}

function evaluateStubContentType(
  headers: readonly Header[],
  body: DslProperty | null,
): ContentType {
  const client = body?.client ?? "";
  let contentType = contentTypeFromHeader(headers, "client");
  if (contentType === "UNKNOWN") contentType = contentTypeFromContent(client);
  if (contentType === "DEFINED" || contentType === "UNKNOWN") {
    const server = body?.server ?? "";
    contentType = contentTypeFromHeader(headers, "server");
    if (contentType === "UNKNOWN") contentType = contentTypeFromContent(server);
  }
  return contentType;
}

// =============================================================================================
// WireMock value patterns
// =============================================================================================

/** `WireMockRequestStubStrategy.clientBody`. */
function clientBody(value: unknown, contentType: ContentType): unknown {
  if (contentType === "FORM") {
    if (value instanceof Map) {
      return [...(value as JMap)]
        .map(([k, v]) => unescapeEcmaScript(`${k}=${javaToString(v)}`))
        .join("&");
    }
    if (Array.isArray(value))
      return value.map((v) => unescapeEcmaScript(javaToString(v))).join("&");
  } else if (value instanceof FromFileProperty) {
    return value.bytes;
  }
  return value;
}

/** `WireMockRequestStubStrategy.convertToValuePattern`. */
function valuePattern(object: unknown, contentType: ContentType): Record<string, unknown> {
  if (object instanceof JavaPattern) return { matches: object.pattern };
  if (object instanceof MatchingStrategy) {
    const value = object.value;
    if (object.type === "ABSENT") return { absent: true };
    if (value === null || value === undefined) {
      throw new YamlConversionError(`A ${object.type} matcher needs a value`);
    }
    const text = (): string => javaToString(clientBody(value, contentType));
    switch (object.type) {
      case "NOT_MATCHING":
        return { doesNotMatch: javaToString(value) };
      case "EQUAL_TO":
        return { equalTo: text() };
      case "CONTAINS":
        return { contains: text() };
      case "MATCHING":
        return { matches: text() };
      case "EQUAL_TO_JSON":
        return { equalToJson: text() };
      case "EQUAL_TO_XML":
        return { equalToXml: text() };
      case "BINARY_EQUAL_TO": {
        const bytes = clientBody(value, contentType);
        if (!(bytes instanceof Uint8Array)) {
          throw new YamlConversionError("A binary matcher needs bytes");
        }
        return { binaryEqualTo: Buffer.from(bytes).toString("base64") };
      }
    }
  }
  if (object === null || object === undefined)
    throw new YamlConversionError("A matcher needs a value");
  const body = clientBody(object, contentType);
  if (body instanceof Uint8Array)
    throw new YamlConversionError("Binary values cannot be compared as text");
  return { equalTo: javaToString(body) };
}

function xPathPattern(matcher: BodyMatcher, body: string): Record<string, unknown> {
  let value: string;
  if (matcher.value !== null) value = matcher.value;
  else if (matcher.type === "NULL" || matcher.type === "COMMAND" || matcher.type === "TYPE") {
    throw new YamlConversionError("Null, Command and Type matchers are not supported in requests.");
  } else if (matcher.type === "EQUALITY") {
    const doc = parseXmlDocument(body);
    if (doc === null) throw new YamlConversionError("The XML body is not well formed");
    value = xPathString(doc, matcher.path);
  } else value = "";
  return {
    matchesXPath: {
      expression: matcher.path,
      ...(matcher.type === "EQUALITY" ? { equalTo: value } : { matches: value }),
    },
  };
}

function multipartParam(name: string, value: string): string {
  return `.*--(.*)\r?\nContent-Disposition: form-data; name="${name}"\r?\n(Content-Type: .*\r?\n)?(Content-Transfer-Encoding: .*\r?\n)?(Content-Length: \\d+\r?\n)?\r?\n${value}\r?\n--.*`;
}

function multipartFile(
  name: string,
  fileName: string,
  content: string,
  contentType: string,
): string {
  return `.*--(.*)\r?\nContent-Disposition: form-data; name="${name}"; filename="${fileName}"\r?\n(Content-Type: ${contentType}\r?\n)?(Content-Transfer-Encoding: .*\r?\n)?(Content-Length: \\d+\r?\n)?\r?\n${content}\r?\n--.*`;
}

/** `getStubSideValue(String)` of a URL: a URL that reads as a JSON object or array is refused. */
function stubSideString(text: string): string {
  const value = stubSideValues(text);
  if (typeof value !== "string") {
    throw new YamlConversionError(
      `The URL [${text}] reads as JSON, which the JVM cannot use as a URL`,
    );
  }
  return value;
}

// =============================================================================================
// JSON bodies
// =============================================================================================

/** `BaseWireMockStubStrategy.toJson`. */
function toJson(value: unknown): string {
  const json = jacksonWrite(value);
  return value instanceof Map ? json.replaceAll("\\\\\\", "\\") : json;
}

/** `BaseWireMockStubStrategy.parseBody(List)`. */
function parseListBody(list: readonly unknown[]): string {
  const result = list.map((item): unknown => {
    if (item instanceof Map) return stubSideValues(item);
    if (Array.isArray(item)) return parseListBody(item);
    if (typeof item === "boolean" || isJavaNumber(item) || item === null) return item;
    return javaToString(item);
  });
  return toJson(result);
}

function containsJsonPathTemplateEntry(line: string): boolean {
  return (
    line.includes("{{jsonpath") ||
    line.includes("{{jsonPath") ||
    line.includes("{{{jsonpath") ||
    line.includes("{{{jsonPath")
  );
}

const JSON_PATH_TEMPLATES = [
  /^.*\{\{\{jsonpath this '(.*)'\}\}\}.*$/,
  /^.*\{\{\{jsonPath request\.body '(.*)'\}\}\}.*$/,
  /^.*\{\{jsonpath this '(.*)'\}\}.*$/,
  /^.*\{\{jsonPath request\.body '(.*)'\}\}.*$/,
];

function jsonPathFromTemplateEntry(line: string): string {
  for (const pattern of JSON_PATH_TEMPLATES) {
    const m = pattern.exec(line);
    if (m !== null && !/[\n\r\u0085\u2028\u2029]/.test(m[0])) return m[1] ?? "";
  }
  return "";
}

/**
 * A plain JSON mirror of a Java value for the JSONPath engine, remembering which Java container
 * each mirrored object or array stands for.
 */
function mirror(value: unknown, back: Map<object, unknown>): unknown {
  if (value instanceof Map) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of value as JMap) {
      Object.defineProperty(out, String(k), {
        value: mirror(v, back),
        enumerable: true,
        writable: true,
        configurable: true,
      });
    }
    back.set(out, value);
    return out;
  }
  if (Array.isArray(value)) {
    const out = value.map((v) => mirror(v, back));
    back.set(out, value);
    return out;
  }
  if (value instanceof JavaInt) return Number(value.value);
  if (value instanceof JavaDouble) return value.value;
  return value;
}

/** A deep copy of a Java value (`CloneUtils.clone`). */
function clone(value: unknown): unknown {
  if (value instanceof Map) return new Map([...(value as JMap)].map(([k, v]) => [k, clone(v)]));
  if (Array.isArray(value)) return value.map(clone);
  return value;
}

/** A document a JSONPath can be read from and deleted in, like Jayway's `DocumentContext`. */
class JsonDocument {
  constructor(private root: unknown) {}

  get value(): unknown {
    return this.root;
  }

  /** `read`: the value, the list of matches for an indefinite path; throws when missing. */
  read(path: string): unknown {
    const back = new Map<object, unknown>();
    const plain = mirror(this.root, back);
    const result = evaluateJsonPath(plain, path);
    // The Java values themselves (numbers keep their Java type), found through their containers.
    const found = path.trim() === "$" ? undefined : jsonPathLocations(plain, path);
    if (found !== undefined && found.locations.length === result.values.length) {
      const values = found.locations.map(({ parent, key }) => {
        const target = back.get(parent);
        return target instanceof Map
          ? (target as Map<string, unknown>).get(String(key))
          : (target as unknown[])[key as number];
      });
      if (result.definite) {
        if (values.length === 0) throw new Error(`No results for path: ${path}`);
        return values[0];
      }
      return values;
    }
    const unmirror = (v: unknown): unknown =>
      typeof v === "object" && v !== null && back.has(v) ? back.get(v) : v;
    if (result.definite) {
      if (result.values.length === 0) throw new Error(`No results for path: ${path}`);
      return unmirror(result.values[0]);
    }
    return result.values.map(unmirror);
  }

  delete(path: string): void {
    const back = new Map<object, unknown>();
    const plain = mirror(this.root, back);
    const found = jsonPathLocations(plain, path);
    if (found === undefined) {
      if (path.trim() === "$") throw new Error("Cannot delete the root");
      return;
    }
    const byParent = new Map<unknown, (string | number)[]>();
    for (const { parent, key } of found.locations) {
      const target = back.get(parent);
      if (target === undefined) continue;
      const keys = byParent.get(target) ?? [];
      keys.push(key);
      byParent.set(target, keys);
    }
    for (const [target, keys] of byParent) {
      if (target instanceof Map) for (const k of keys) target.delete(String(k));
      else if (Array.isArray(target)) {
        const indexes = [...new Set(keys as number[])].sort((a, b) => b - a);
        for (const i of indexes) target.splice(i, 1);
      }
    }
  }
}

/** `JsonPathMatcherUtils.removeMatchingJsonPaths`. */
function removeMatchingJsonPaths(json: unknown, matchers: readonly BodyMatcher[]): unknown {
  const copy = clone(json);
  if (matchers.length === 0) return copy;
  if (!(copy instanceof Map) && !Array.isArray(copy)) return copy;
  const context = new JsonDocument(copy);
  const deleted: string[] = [];
  for (const matcher of matchers) {
    try {
      const entry = readOrNull(context, matcher.path);
      if (entry !== null) {
        context.delete(matcher.path);
        deleted.push(matcher.path);
      }
    } catch {
      // as the JVM: a path that cannot be deleted is left alone
    }
  }
  deleted.sort().reverse();
  for (const path of deleted) removeTrailingContainers(path, context);
  return context.value;
}

function readOrNull(context: JsonDocument, path: string): unknown {
  try {
    const value = context.read(path);
    return value === undefined ? null : value;
  } catch {
    return null;
  }
}

function isIterable(value: unknown): boolean {
  return value instanceof Map || Array.isArray(value);
}

function containsOnlyEmptyElements(value: unknown): boolean {
  const items =
    value instanceof Map ? [...(value as JMap).values()] : Array.isArray(value) ? value : null;
  if (items === null) return false;
  return items.every(
    (item) =>
      (item instanceof Map && item.size === 0) || (Array.isArray(item) && item.length === 0),
  );
}

function removeTrailingContainers(matcherPath: string, context: JsonDocument): boolean {
  try {
    const arrays = [...matcherPath.matchAll(/\[(.*?)\]/g)];
    const last = arrays[arrays.length - 1];
    const pathWithoutArray =
      last !== undefined ? matcherPath.substring(0, matcherPath.lastIndexOf(last[0])) : matcherPath;
    const object = readOrNull(context, pathWithoutArray);
    if (
      object !== null &&
      isIterable(object) &&
      containsOnlyEmptyElements(object) &&
      matcherPath !== "$[*]"
    ) {
      const pathToDelete = pathWithoutArray === "$" ? "$[*]" : pathWithoutArray;
      if (pathToDelete.includes("..")) {
        const root = context.read("$");
        if (Array.isArray(root) && root.every((item) => containsOnlyEmptyElements(item))) {
          context.delete("$[*]");
        }
        return false;
      }
      context.delete(pathToDelete);
      return removeTrailingContainers(pathToDelete, context);
    }
    const lastDot = matcherPath.lastIndexOf(".");
    if (lastDot === -1) return false;
    const parent = matcherPath.substring(0, lastDot);
    const parentObject = context.read(parent);
    if (isIterable(parentObject) && containsOnlyEmptyElements(parentObject) && parent !== "$") {
      context.delete(parent);
      return removeTrailingContainers(parent, context);
    }
    return false;
  } catch {
    return false;
  }
}

/** `WireMock.matchingJsonPath`: Jayway compiles the expression, refusing an invalid one. */
function matchingJsonPath(path: string): Record<string, unknown> {
  try {
    evaluateJsonPath(null, path);
  } catch (err: unknown) {
    if (err instanceof JsonPathSyntaxError) {
      throw new YamlConversionError(
        `Invalid JSONPath generated for the request body: ${err.message}`,
      );
    }
  }
  return { matchesJsonPath: path };
}

/** `JsonPathMatcherUtils.convertJsonPathAndRegexToAJsonPath`. */
function jsonPathForMatcher(matcher: BodyMatcher, body: unknown): string {
  const path = matcher.path;
  if (matcher.value === null && matcher.type !== "EQUALITY" && matcher.type !== "TYPE") return path;
  const lastDot = findLastDotIndex(path);
  const toLastDot = lastDot === -1 ? "$" : path.substring(0, lastDot);
  const fromLastDot = path.substring(lastDot + 1);
  const property = lastDot === -1 ? "@" : `@.${fromLastDot}`;
  let comparison: string;
  if (matcher.type === "EQUALITY") {
    let value: unknown;
    try {
      value = new JsonDocument(transformValues(body, (v) => v)).read(path);
    } catch {
      throw new YamlConversionError(`Value [${path}] not found in JSON [${jacksonWrite(body)}]`);
    }
    if (value === null || value === undefined) {
      throw new YamlConversionError(`Value [${path}] is null in the request body`);
    }
    // An indefinite path reads a json-smart JSONArray, whose toString() is JSON.
    const text =
      Array.isArray(value) && !evaluateJsonPath(null, path).definite
        ? jsonSmartWrite(value)
        : javaToString(value);
    comparison = `${property} == ${isJavaNumber(value) ? value.toString() : `'${text}'`}`;
  } else if (matcher.type === "TYPE") {
    const parts: string[] = [];
    if (matcher.min !== null) parts.push(`${property}.size() >= ${matcher.min}`);
    if (matcher.max !== null) parts.push(`${property}.size() <= ${matcher.max}`);
    comparison = parts.join(" && ");
    if (comparison === "") {
      throw new YamlConversionError(
        `Failed to parse filter: [?()] (a by_type request matcher on ${path} needs minOccurrence or maxOccurrence)`,
      );
    }
  } else {
    let converted = matcher.value ?? "";
    if (!converted.includes("\\/")) converted = converted.replaceAll("/", "\\\\/");
    comparison = `${property} =~ /(${converted})/`;
  }
  return `${toLastDot}[?(${comparison})]`;
}

/** json-smart's `JSONValue.toJSONString` (its default style, which escapes `/`). */
function jsonSmartWrite(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value === "string") return jsonSmartString(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  if (value instanceof JavaDouble) return Number.isFinite(value.value) ? value.toString() : "null";
  if (value instanceof JavaInt) return value.toString();
  if (value instanceof Map) {
    const entries = [...(value as JMap)].map(
      ([k, v]) => `${jsonSmartString(String(k))}:${jsonSmartWrite(v)}`,
    );
    return `{${entries.join(",")}}`;
  }
  if (Array.isArray(value)) return `[${value.map(jsonSmartWrite).join(",")}]`;
  return jsonSmartString(javaToString(value));
}

const JSON_SMART_ESCAPES: Readonly<Record<string, string>> = {
  '"': '\\"',
  "\\": "\\\\",
  "\b": "\\b",
  "\f": "\\f",
  "\n": "\\n",
  "\r": "\\r",
  "\t": "\\t",
  "/": "\\/",
};

function jsonSmartString(text: string): string {
  let out = '"';
  for (let i = 0; i < text.length; i++) {
    const ch = text.charAt(i);
    const c = text.charCodeAt(i);
    const escape = JSON_SMART_ESCAPES[ch];
    if (escape !== undefined) out += escape;
    else if (c <= 0x1f || (c >= 0x7f && c <= 0x9f) || (c >= 0x2000 && c <= 0x20ff)) {
      out += `\\u${c.toString(16).toUpperCase().padStart(4, "0")}`;
    } else out += ch;
  }
  return `${out}"`;
}

function findLastDotIndex(path: string): number {
  if (path.includes("['")) {
    const bracket = path.lastIndexOf("['");
    return path.substring(0, bracket).lastIndexOf(".");
  }
  return path.lastIndexOf(".");
}

function javaTrim(text: string): string {
  let start = 0;
  let end = text.length;
  while (start < end && text.charCodeAt(start) <= 0x20) start++;
  while (end > start && text.charCodeAt(end - 1) <= 0x20) end--;
  return text.slice(start, end);
}

function javaTrimLower(text: string): string {
  return javaTrim(text).toLowerCase();
}
