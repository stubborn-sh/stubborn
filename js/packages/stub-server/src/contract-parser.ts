import yaml from "js-yaml";
import { parseWireMockMapping } from "./wiremock-parser.js";
import {
  loadYamlContracts,
  yamlContractToWireMock,
  type WireMockMappingJson,
} from "./yaml-to-wiremock.js";

/** WireMock body pattern for request matching. */
export interface RequestBodyPattern {
  /** Full body JSON equality. */
  readonly equalToJson?: string;
  /** JSONPath filter expression (e.g., "$[?(@.['field'] == 'value')]"). */
  readonly matchesJsonPath?: string;
  /** Regex pattern to match against the raw body string. */
  readonly matches?: string;
}

/** Parsed request portion of a contract. */
export interface ContractRequest {
  readonly method: string;
  readonly url?: string;
  readonly urlPath?: string;
  readonly headers?: Readonly<Record<string, string>>;
  readonly body?: unknown;
  readonly queryParameters?: Readonly<Record<string, string>>;
  /** WireMock body patterns — all must match (AND logic). */
  readonly bodyPatterns?: readonly RequestBodyPattern[];
  /**
   * The WireMock `request` pattern this contract was parsed from. When present, requests are
   * matched with WireMock's semantics against it (the other fields are kept for callers that
   * read them, e.g. to build a request).
   */
  readonly wireMock?: Readonly<Record<string, unknown>>;
}

/** Parsed response portion of a contract. */
export interface ContractResponse {
  readonly status: number;
  readonly headers?: Readonly<Record<string, string>>;
  readonly body?: unknown;
  readonly matchers?: ResponseMatchers;
  /** Simulated latency in milliseconds (from WireMock fixedDelayMilliseconds). */
  readonly delayMs?: number;
  /**
   * Render the body and header values as WireMock response templates against the incoming
   * request (set when a WireMock mapping lists the `response-template` transformer). The body is
   * then kept as the raw template text.
   */
  readonly responseTemplating?: boolean;
  /**
   * The body exactly as it is served — text, or bytes for a binary or file body — taking
   * precedence over {@link body} (kept as parsed JSON for callers that read it). Nothing is
   * added: a response with a raw body gets no Content-Type it does not declare.
   */
  readonly rawBody?: string | Uint8Array;
  /** A WireMock fault served instead of a response. */
  readonly fault?: ResponseFault;
  /** A random delay added to {@link delayMs} (WireMock `delayDistribution`). */
  readonly delayDistribution?: DelayDistribution;
  /** Send the body in chunks spread over a duration (WireMock `chunkedDribbleDelay`). */
  readonly chunkedDribbleDelay?: {
    readonly numberOfChunks: number;
    readonly totalDuration: number;
  };
  /** Forward the request and serve the upstream response (WireMock `proxyBaseUrl`). */
  readonly proxy?: ResponseProxy;
  /** The stub, for WireMock's `Matched-Stub-Id` / `Matched-Stub-Name` response headers. */
  readonly matchedStub?: { readonly id: string; readonly name?: string };
}

/** WireMock's fault types. */
export type ResponseFault =
  | "CONNECTION_RESET_BY_PEER"
  | "EMPTY_RESPONSE"
  | "MALFORMED_RESPONSE_CHUNK"
  | "RANDOM_DATA_THEN_CLOSE";

/** WireMock's delay distributions (milliseconds). */
export type DelayDistribution =
  | {
      readonly type: "lognormal";
      readonly median: number;
      readonly sigma: number;
      readonly maxValue?: number;
    }
  | { readonly type: "uniform"; readonly lower: number; readonly upper: number }
  | { readonly type: "fixed"; readonly milliseconds: number };

/** WireMock proxy settings of a response. */
export interface ResponseProxy {
  readonly baseUrl: string;
  readonly urlPrefixToRemove?: string;
  readonly additionalRequestHeaders?: Readonly<Record<string, string>>;
  readonly removeRequestHeaders?: readonly string[];
}

/** Response body matchers. */
export interface ResponseMatchers {
  readonly body?: readonly BodyMatcher[];
}

/** Individual body field matcher. */
export interface BodyMatcher {
  readonly path: string;
  readonly type: "by_regex" | "by_type" | "by_equality";
  readonly value?: string;
}

/** A fully parsed Spring Cloud Contract. */
export interface ParsedContract {
  readonly name: string;
  readonly request: ContractRequest;
  readonly response: ContractResponse;
  /** WireMock priority (lower = higher priority). */
  readonly priority?: number;
  /**
   * WireMock matchers in this contract's request that stub-server cannot evaluate (e.g. XPath).
   * Such a contract never matches, rather than matching requests WireMock would reject.
   */
  readonly unsupportedMatchers?: readonly string[];
  /** The YAML document this contract was parsed from (absent for WireMock mappings). */
  readonly source?: Readonly<Record<string, unknown>>;
  /**
   * Contents of the files the YAML document references (`bodyFromFile`,
   * `bodyFromFileAsBytes`, `fileContentFromFileAsBytes`), keyed by the path as written in the
   * contract.
   */
  readonly files?: ReadonlyMap<string, Uint8Array>;
  /**
   * The WireMock mapping the JVM generates for this YAML contract (without its `id`), which
   * stub-server serves; absent when the JVM generates none (see {@link unsupportedMatchers}).
   */
  readonly wireMockMapping?: WireMockMappingJson;
}

/** Options for {@link parseContracts}. */
export interface ParseContractOptions {
  /**
   * Reads a file a contract references (`bodyFromFile`…), given its path relative to the
   * contract file; returns undefined when it does not exist. Without it, a contract with a file
   * body is reported as unsupported.
   */
  readonly readFile?: (relativePath: string) => Uint8Array | undefined;
}

interface RawContract {
  request?: {
    method?: string;
    url?: string;
    urlPath?: string;
    headers?: Record<string, string>;
    body?: unknown;
    queryParameters?: Record<string, string>;
  };
  response?: {
    status?: number;
    headers?: Record<string, string>;
    body?: unknown;
    matchers?: {
      body?: Array<{
        path?: string;
        type?: string;
        value?: string;
      }>;
    };
  };
}

/**
 * Parse a YAML contract string into a ParsedContract.
 * Throws if the contract is malformed or missing required fields, or if the file holds more
 * than one contract (use {@link parseContracts} for those).
 */
export function parseContract(name: string, yamlContent: string): ParsedContract {
  const contracts = parseContracts(name, yamlContent);
  if (contracts.length !== 1) {
    throw new Error(`Contract "${name}" holds ${contracts.length} HTTP contracts, not one`);
  }
  return contracts[0] as ParsedContract;
}

/**
 * Parse every HTTP contract in a YAML contract file: like the JVM, a file can hold several
 * documents (`---`), and a document can be a list of contracts. Messaging contracts (no
 * `request`) are skipped. A file with several contracts names them as the JVM does: the
 * contract's `name`, else the file name without its extension, plus `_<document index>` for a
 * document after the first or one holding several contracts.
 */
export function parseContracts(
  name: string,
  yamlContent: string,
  options?: ParseContractOptions,
): ParsedContract[] {
  let documents: unknown[];
  try {
    documents = yaml.loadAll(yamlContent, undefined, { schema: yaml.JSON_SCHEMA });
  } catch (err: unknown) {
    throw new Error(
      `Failed to parse YAML for contract "${name}": ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  // NamesUtil.defaultContractName: `_<document index>` when the index is above 0 or the document
  // holds several contracts.
  const entries: {
    readonly document: unknown;
    readonly index: number;
    readonly suffix: boolean;
  }[] = [];
  documents
    .filter((d) => d !== null && d !== undefined)
    .forEach((document, index) => {
      const items: unknown[] = Array.isArray(document) ? document : [document];
      for (const item of items) {
        entries.push({ document: item, index, suffix: index > 0 || items.length > 1 });
      }
    });
  if (entries.length === 0) throw new Error(`Contract "${name}" is not a valid object`);
  // The same documents as the JVM reads them (SnakeYAML's YAML 1.1 types), for the conversion to
  // the WireMock mapping it generates.
  let javaContracts: readonly unknown[] | string;
  try {
    const loaded = loadYamlContracts(yamlContent).map((c) => c.contract);
    javaContracts =
      loaded.length === entries.length ? loaded : "the JVM reads a different number of contracts";
  } catch (err: unknown) {
    javaContracts = `the JVM cannot read the YAML: ${err instanceof Error ? err.message : String(err)}`;
  }
  const base = name.replace(/\.[^./]*$/, "");
  const contracts: ParsedContract[] = [];
  const several = entries.length > 1;
  for (const [position, { document, index, suffix }] of entries.entries()) {
    if (typeof document !== "object" || document === null || Array.isArray(document)) {
      throw new Error(`Contract "${name}" is not a valid object`);
    }
    const source = document as Record<string, unknown>;
    if (source["request"] === undefined && source["response"] === undefined) continue; // messaging
    const ownName = typeof source["name"] === "string" ? source["name"].trim() : "";
    // A file with one contract keeps the name it was given; otherwise the JVM's names.
    const contractName = !several
      ? name
      : ownName !== ""
        ? ownName
        : suffix
          ? `${base}_${index}`
          : base;
    const javaContract =
      typeof javaContracts === "string" ? new Error(javaContracts) : javaContracts[position];
    contracts.push(parseDocument(contractName, source, options, javaContract));
  }
  return contracts;
}

const FILE_KEYS = ["bodyFromFile", "bodyFromFileAsBytes"] as const;

/** The files a contract references: `[key, path]` pairs. */
function referencedFiles(source: Record<string, unknown>): [string, string][] {
  const out: [string, string][] = [];
  const field = (value: unknown, key: string): unknown =>
    typeof value === "object" && value !== null
      ? (value as Record<string, unknown>)[key]
      : undefined;
  for (const part of [source["request"], source["response"]]) {
    for (const key of FILE_KEYS) {
      const path = field(part, key);
      if (typeof path === "string") out.push([key, path]);
    }
  }
  const named = field(field(source["request"], "multipart"), "named");
  if (Array.isArray(named)) {
    for (const part of named) {
      const path = field(part, "fileContentFromFileAsBytes");
      if (typeof path === "string") out.push(["fileContentFromFileAsBytes", path]);
    }
  }
  return out;
}

function parseDocument(
  name: string,
  source: Record<string, unknown>,
  options: ParseContractOptions | undefined,
  javaContract: unknown,
): ParsedContract {
  const contract = source as RawContract;
  const files = new Map<string, Uint8Array>();
  const missing: string[] = [];
  for (const [key, path] of referencedFiles(source)) {
    if (files.has(path)) continue;
    const content = options?.readFile?.(path);
    if (content === undefined) missing.push(`${key}: ${path}`);
    else files.set(path, content);
  }

  if (contract.request === undefined) {
    throw new Error(`Contract "${name}" is missing required "request" field`);
  }

  if (contract.response === undefined) {
    throw new Error(`Contract "${name}" is missing required "response" field`);
  }

  if (contract.request.method === undefined || contract.request.method === "") {
    throw new Error(`Contract "${name}" request is missing required "method" field`);
  }

  if (contract.request.url === undefined && contract.request.urlPath === undefined) {
    throw new Error(`Contract "${name}" request must have either "url" or "urlPath"`);
  }

  const request: ContractRequest = {
    method: contract.request.method.toUpperCase(),
    ...(contract.request.url !== undefined ? { url: contract.request.url } : {}),
    ...(contract.request.urlPath !== undefined ? { urlPath: contract.request.urlPath } : {}),
    ...(contract.request.headers !== undefined ? { headers: contract.request.headers } : {}),
    ...(contract.request.body !== undefined ? { body: contract.request.body } : {}),
    ...(contract.request.queryParameters !== undefined
      ? { queryParameters: contract.request.queryParameters }
      : {}),
  };

  const status = contract.response.status ?? 200;

  const matchers: ResponseMatchers | undefined =
    contract.response.matchers?.body !== undefined
      ? {
          body: contract.response.matchers.body
            .filter(
              (m): m is { path: string; type: string; value?: string } =>
                typeof m.path === "string" && typeof m.type === "string",
            )
            .map((m) => ({
              path: m.path,
              type: m.type as BodyMatcher["type"],
              ...(m.value !== undefined ? { value: m.value } : {}),
            })),
        }
      : undefined;

  const response: ContractResponse = {
    status,
    ...(contract.response.headers !== undefined ? { headers: contract.response.headers } : {}),
    ...(contract.response.body !== undefined ? { body: contract.response.body } : {}),
    ...(matchers !== undefined ? { matchers } : {}),
  };

  const unsupported = missing.map((m) => `file not found next to the contract (${m})`);
  let mapping: WireMockMappingJson | undefined;
  if (unsupported.length === 0) {
    try {
      if (javaContract instanceof Error) throw javaContract;
      mapping = yamlContractToWireMock(javaContract, { files });
      if (mapping === undefined) {
        unsupported.push("ignored: the JVM generates no stub for an ignored contract");
      }
    } catch (err: unknown) {
      unsupported.push(
        `the JVM cannot convert this contract to a stub: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  const base = { name, source, ...(files.size > 0 ? { files } : {}) };
  if (mapping === undefined) {
    return { ...base, request, response, unsupportedMatchers: unsupported };
  }

  // Served like the WireMock mapping the JVM generates; the YAML's own fields stay for the
  // callers that read them.
  const stub = parseWireMockMapping(name, JSON.stringify(mapping));
  return {
    ...base,
    request: {
      ...request,
      ...(stub.request.wireMock !== undefined ? { wireMock: stub.request.wireMock } : {}),
    },
    response: {
      ...stub.response,
      ...(response.body !== undefined ? { body: response.body } : {}),
      ...(matchers !== undefined ? { matchers } : {}),
    },
    ...(stub.priority !== undefined ? { priority: stub.priority } : {}),
    ...(stub.unsupportedMatchers !== undefined
      ? { unsupportedMatchers: stub.unsupportedMatchers }
      : {}),
    wireMockMapping: mapping,
  };
}
