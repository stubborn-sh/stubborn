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
}

/** Parsed response portion of a contract. */
export interface ContractResponse {
  readonly status: number;
  readonly headers?: Readonly<Record<string, string>>;
  readonly body?: unknown;
  readonly matchers?: ResponseMatchers;
  /** Simulated latency in milliseconds (from WireMock fixedDelayMilliseconds). */
  readonly delayMs?: number;
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
 * Throws if the contract is malformed or missing required fields.
 */
export function parseContract(name: string, yamlContent: string): ParsedContract {
  let raw: unknown;
  try {
    raw = yaml.load(yamlContent, { schema: yaml.JSON_SCHEMA });
  } catch (err: unknown) {
    throw new Error(
      `Failed to parse YAML for contract "${name}": ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  if (typeof raw !== "object" || raw === null) {
    throw new Error(`Contract "${name}" is not a valid object`);
  }

  const contract = raw as RawContract;

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

  return { name, request, response };
}
