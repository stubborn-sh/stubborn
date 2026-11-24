import yaml from "js-yaml";

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
   * `bodyFromFileAsBytes`), keyed by the path as written in the contract.
   */
  readonly files?: ReadonlyMap<string, Uint8Array>;
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
 * contract's `name`, else the file name without its extension and `_<index>`.
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
  const entries: { readonly document: unknown; readonly index: number; readonly many: boolean }[] =
    [];
  documents
    .filter((d) => d !== null && d !== undefined)
    .forEach((document, index, all) => {
      if (Array.isArray(document)) {
        for (const item of document) entries.push({ document: item, index, many: true });
      } else entries.push({ document, index, many: all.length > 1 });
    });
  if (entries.length === 0) throw new Error(`Contract "${name}" is not a valid object`);
  const base = name.replace(/\.[^./]*$/, "");
  const contracts: ParsedContract[] = [];
  for (const { document, index, many } of entries) {
    if (typeof document !== "object" || document === null || Array.isArray(document)) {
      throw new Error(`Contract "${name}" is not a valid object`);
    }
    const source = document as Record<string, unknown>;
    if (source["request"] === undefined && source["response"] === undefined) continue; // messaging
    const ownName = typeof source["name"] === "string" ? source["name"].trim() : "";
    const contractName = !many ? name : ownName !== "" ? ownName : `${base}_${index}`;
    contracts.push(parseDocument(contractName, source, options));
  }
  return contracts;
}

const FILE_KEYS = ["bodyFromFile", "bodyFromFileAsBytes"] as const;

function parseDocument(
  name: string,
  source: Record<string, unknown>,
  options: ParseContractOptions | undefined,
): ParsedContract {
  const contract = source as RawContract;
  const files = new Map<string, Uint8Array>();
  const missing: string[] = [];
  for (const part of [source["request"], source["response"]]) {
    if (typeof part !== "object" || part === null) continue;
    for (const key of FILE_KEYS) {
      const path = (part as Record<string, unknown>)[key];
      if (typeof path !== "string") continue;
      const content = options?.readFile?.(path);
      if (content === undefined) missing.push(`${key}: ${path}`);
      else files.set(path, content);
    }
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

  return {
    name,
    request,
    response,
    source,
    ...(files.size > 0 ? { files } : {}),
    ...(missing.length > 0
      ? { unsupportedMatchers: missing.map((m) => `file not found next to the contract (${m})`) }
      : {}),
  };
}
