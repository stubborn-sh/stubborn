import type { ScannedContract } from "@stubborn-sh/publisher";
import yaml from "js-yaml";

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
  return JSON.stringify(mapping, null, 2);
}

function buildMapping(parsed: ParsedYamlContract): WireMockMapping {
  // Safe: validated in contractToWireMock before calling buildMapping
  const req = parsed.request as NonNullable<ParsedYamlContract["request"]>;
  const res = parsed.response as NonNullable<ParsedYamlContract["response"]>;

  const request = buildWireMockRequest(req);
  const response = buildWireMockResponse(res);

  return {
    request,
    response,
    ...(parsed.priority !== undefined ? { priority: parsed.priority } : {}),
  };
}

function buildWireMockRequest(req: NonNullable<ParsedYamlContract["request"]>): WireMockRequest {
  const result: Record<string, unknown> = {
    method: (req.method ?? "").toUpperCase(),
  };

  if (req.urlPath !== undefined) {
    result["urlPath"] = req.urlPath;
  } else if (req.url !== undefined) {
    result["url"] = req.url;
  }

  if (req.headers !== undefined && Object.keys(req.headers).length > 0) {
    const wireMockHeaders: Record<string, WireMockMatcher> = {};
    for (const [key, value] of Object.entries(req.headers)) {
      wireMockHeaders[key] = { equalTo: value };
    }
    result["headers"] = wireMockHeaders;
  }

  if (req.queryParameters !== undefined && Object.keys(req.queryParameters).length > 0) {
    const wireMockParams: Record<string, WireMockMatcher> = {};
    for (const [key, value] of Object.entries(req.queryParameters)) {
      wireMockParams[key] = { equalTo: value };
    }
    result["queryParameters"] = wireMockParams;
  }

  if (req.body !== undefined) {
    const bodyStr = typeof req.body === "string" ? req.body : JSON.stringify(req.body);
    result["bodyPatterns"] = [{ equalToJson: bodyStr }];
  }

  return result as unknown as WireMockRequest;
}

function buildWireMockResponse(res: NonNullable<ParsedYamlContract["response"]>): WireMockResponse {
  const result: Record<string, unknown> = {
    status: res.status ?? 200,
  };

  if (res.headers !== undefined && Object.keys(res.headers).length > 0) {
    result["headers"] = res.headers;
  }

  if (res.body !== undefined) {
    if (typeof res.body === "object" && res.body !== null) {
      result["jsonBody"] = res.body;
    } else {
      result["body"] = typeof res.body === "string" ? res.body : JSON.stringify(res.body);
    }
  }

  return result as unknown as WireMockResponse;
}
