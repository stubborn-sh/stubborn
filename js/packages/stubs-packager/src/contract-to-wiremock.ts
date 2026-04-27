import type { ScannedContract } from "@stubborn-sh/publisher";
import type { ParsedContract } from "@stubborn-sh/stub-server";
import yaml from "js-yaml";
import { parseOpenApiContracts } from "@stubborn-sh/stub-server";

/** Raw WireMock mapping JSON structure for serialization. */
interface WireMockMapping {
  readonly request: WireMockRequest;
  readonly response: WireMockResponse;
  readonly priority?: number;
}

interface WireMockRequest {
  readonly method: string;
  readonly url?: string;
  readonly urlPath?: string;
  readonly headers?: Record<string, WireMockMatcher>;
  readonly queryParameters?: Record<string, WireMockMatcher>;
  readonly bodyPatterns?: readonly WireMockBodyPattern[];
}

interface WireMockMatcher {
  readonly equalTo: string;
}

interface WireMockBodyPattern {
  readonly equalToJson?: string;
  readonly matchesJsonPath?: string;
  readonly matches?: string;
}

interface WireMockResponse {
  readonly status: number;
  readonly headers?: Record<string, string>;
  readonly body?: string;
  readonly jsonBody?: unknown;
}

interface ParsedYamlContract {
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
  };
  priority?: number;
}

/**
 * Convert a scanned YAML contract to a WireMock JSON mapping string.
 *
 * This is the reverse of `parseWireMockMapping` from the stub-server package.
 * The output is compatible with Java Stub Runner (WireMock format).
 */
export function contractToWireMock(contract: ScannedContract): string {
  let raw: unknown;
  try {
    raw = yaml.load(contract.content, { schema: yaml.JSON_SCHEMA });
  } catch (err: unknown) {
    throw new Error(
      `Failed to parse YAML contract "${contract.contractName}": ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  if (typeof raw !== "object" || raw === null) {
    throw new Error(`Contract "${contract.contractName}" is not a valid object`);
  }

  const parsed = raw as ParsedYamlContract;

  if (parsed.request === undefined) {
    throw new Error(`Contract "${contract.contractName}" is missing required "request" field`);
  }

  if (parsed.response === undefined) {
    throw new Error(`Contract "${contract.contractName}" is missing required "response" field`);
  }

  if (parsed.request.method === undefined || parsed.request.method === "") {
    throw new Error(
      `Contract "${contract.contractName}" request is missing required "method" field`,
    );
  }

  const mapping = buildMapping(parsed);
  return safeStringify(mapping, contract.contractName);
}

function buildMapping(parsed: ParsedYamlContract): WireMockMapping {
  // Safe: validated in contractToWireMock before calling buildMapping
  const req = parsed.request as NonNullable<ParsedYamlContract["request"]>;
  const res = parsed.response as NonNullable<ParsedYamlContract["response"]>;

  return parsedContractToWireMock({
    method: (req.method ?? "").toUpperCase(),
    url: req.url,
    urlPath: req.urlPath,
    headers: req.headers,
    queryParameters: req.queryParameters,
    body: req.body,
    status: res.status ?? 200,
    responseHeaders: res.headers,
    responseBody: res.body,
    priority: parsed.priority,
  });
}

interface WireMockInput {
  readonly method: string;
  readonly url?: string;
  readonly urlPath?: string;
  readonly headers?: Readonly<Record<string, string>>;
  readonly queryParameters?: Readonly<Record<string, string>>;
  readonly body?: unknown;
  readonly status: number;
  readonly responseHeaders?: Readonly<Record<string, string>>;
  readonly responseBody?: unknown;
  readonly priority?: number;
}

function parsedContractToWireMock(input: WireMockInput): WireMockMapping {
  const request: Record<string, unknown> = { method: input.method };

  if (input.urlPath !== undefined) {
    request["urlPath"] = input.urlPath;
  } else if (input.url !== undefined) {
    request["url"] = input.url;
  }

  if (input.headers !== undefined && Object.keys(input.headers).length > 0) {
    const wireMockHeaders: Record<string, WireMockMatcher> = {};
    for (const [key, value] of Object.entries(input.headers)) {
      wireMockHeaders[key] = { equalTo: value };
    }
    request["headers"] = wireMockHeaders;
  }

  if (input.queryParameters !== undefined && Object.keys(input.queryParameters).length > 0) {
    const wireMockParams: Record<string, WireMockMatcher> = {};
    for (const [key, value] of Object.entries(input.queryParameters)) {
      wireMockParams[key] = { equalTo: value };
    }
    request["queryParameters"] = wireMockParams;
  }

  if (input.body !== undefined) {
    const bodyStr = typeof input.body === "string" ? input.body : JSON.stringify(input.body);
    request["bodyPatterns"] = [{ equalToJson: bodyStr }];
  }

  const response: Record<string, unknown> = { status: input.status };

  if (input.responseHeaders !== undefined && Object.keys(input.responseHeaders).length > 0) {
    response["headers"] = input.responseHeaders;
  }

  if (input.responseBody !== undefined) {
    if (typeof input.responseBody === "object" && input.responseBody !== null) {
      response["jsonBody"] = input.responseBody;
    } else {
      response["body"] =
        typeof input.responseBody === "string"
          ? input.responseBody
          : JSON.stringify(input.responseBody);
    }
  }

  return {
    request: request as unknown as WireMockRequest,
    response: response as unknown as WireMockResponse,
    ...(input.priority !== undefined ? { priority: input.priority } : {}),
  };
}

/**
 * Convert a scanned OpenAPI contract to multiple WireMock JSON mapping strings.
 * One WireMock mapping is produced per x-contracts entry.
 */
export function openApiContractsToWireMock(contract: ScannedContract): readonly string[] {
  const parsed = parseOpenApiContracts(contract.contractName, contract.content);
  return parsed.map((c) => {
    const mapping = parsedContractToWireMock({
      method: c.request.method,
      url: c.request.url,
      urlPath: c.request.urlPath,
      headers: c.request.headers,
      queryParameters: c.request.queryParameters,
      body: c.request.body,
      status: c.response.status,
      responseHeaders: c.response.headers,
      responseBody: c.response.body,
      priority: c.priority,
    });
    return safeStringify(mapping, contract.contractName);
  });
}

function safeStringify(value: unknown, contractName: string): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch (err: unknown) {
    throw new Error(
      `Failed to serialize WireMock mapping for "${contractName}": ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}
