import { readFileSync, existsSync } from "node:fs";
import { resolve, sep } from "node:path";
import type {
  ParsedContract,
  ContractRequest,
  ContractResponse,
  RequestBodyPattern,
} from "./contract-parser.js";

/** Raw WireMock mapping JSON structure. */
interface WireMockMapping {
  readonly id?: string;
  readonly uuid?: string;
  readonly priority?: number;
  readonly request?: {
    readonly method?: string;
    readonly url?: string;
    readonly urlPath?: string;
    readonly urlPattern?: string;
    readonly urlPathPattern?: string;
    readonly headers?: Readonly<Record<string, WireMockMatcher>>;
    readonly queryParameters?: Readonly<Record<string, WireMockMatcher>>;
    readonly bodyPatterns?: readonly WireMockBodyPattern[];
  };
  readonly response?: {
    readonly status?: number;
    readonly body?: string;
    readonly jsonBody?: unknown;
    readonly bodyFileName?: string;
    readonly headers?: Readonly<Record<string, string>>;
    readonly fixedDelayMilliseconds?: number;
    readonly transformers?: readonly string[];
  };
}

interface WireMockMatcher {
  readonly equalTo?: string;
  readonly contains?: string;
  readonly matches?: string;
}

interface WireMockBodyPattern {
  readonly equalToJson?: string;
  readonly matchesJsonPath?: string;
  readonly matches?: string;
}

/** Options for WireMock mapping parsing. */
export interface WireMockParseOptions {
  /**
   * Path to the `__files/` directory for resolving `bodyFileName` references.
   * When provided, `bodyFileName` values are resolved to actual file content.
   * When omitted, `bodyFileName` produces a placeholder string.
   */
  readonly filesDir?: string;
}

/** Spring Security CSRF parameter injected during RestDocs capture — not a real contract constraint. */
const IGNORED_QUERY_PARAMS = new Set(["_csrf"]);

/**
 * Parse a WireMock JSON mapping string into a ParsedContract.
 * Throws if the mapping is malformed or missing required fields.
 */
export function parseWireMockMapping(
  name: string,
  json: string,
  options?: WireMockParseOptions,
): ParsedContract {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch (err: unknown) {
    throw new Error(
      `Failed to parse WireMock JSON "${name}": ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  if (typeof raw !== "object" || raw === null) {
    throw new Error(`WireMock mapping "${name}" is not a valid object`);
  }

  const mapping = raw as WireMockMapping;

  if (mapping.request === undefined) {
    throw new Error(`WireMock mapping "${name}" is missing required "request" field`);
  }

  if (mapping.response === undefined) {
    throw new Error(`WireMock mapping "${name}" is missing required "response" field`);
  }

  const request = buildRequest(name, mapping);
  const response = buildResponse(mapping, options);
  const priority = mapping.priority;

  return {
    name,
    request,
    response,
    ...(priority !== undefined ? { priority } : {}),
  };
}

function buildRequest(name: string, mapping: WireMockMapping): ContractRequest {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- validated in parseWireMockMapping
  const req = mapping.request!;
  const method = req.method?.toUpperCase();

  if (method === undefined || method === "") {
    throw new Error(`WireMock mapping "${name}" request is missing "method"`);
  }

  // Resolve URL — urlPath and url are exact, urlPathPattern/urlPattern are regex (use as-is)
  const urlPath = req.urlPath ?? req.urlPathPattern;
  const url = req.url ?? req.urlPattern;

  if (url === undefined && urlPath === undefined) {
    throw new Error(`WireMock mapping "${name}" request must have "url" or "urlPath"`);
  }

  // Extract headers: WireMock uses { "Header": { "equalTo": "value" } }
  let headers: Record<string, string> | undefined;
  if (req.headers !== undefined) {
    headers = {};
    for (const [key, matcher] of Object.entries(req.headers)) {
      if (matcher.equalTo !== undefined) {
        headers[key] = matcher.equalTo;
      }
    }
    if (Object.keys(headers).length === 0) headers = undefined;
  }

  // Extract query parameters, filtering Spring Security CSRF artifacts
  let queryParameters: Record<string, string> | undefined;
  if (req.queryParameters !== undefined) {
    queryParameters = {};
    for (const [key, matcher] of Object.entries(req.queryParameters)) {
      if (IGNORED_QUERY_PARAMS.has(key)) continue;
      if (matcher.equalTo !== undefined) {
        queryParameters[key] = matcher.equalTo;
      }
    }
    if (Object.keys(queryParameters).length === 0) queryParameters = undefined;
  }

  // Extract request body from bodyPatterns
  let body: unknown;
  const bodyPatterns: RequestBodyPattern[] = [];

  if (req.bodyPatterns !== undefined) {
    for (const pattern of req.bodyPatterns) {
      if (pattern.equalToJson !== undefined) {
        // equalToJson: use as the canonical body for simple matching
        if (body === undefined) {
          try {
            body = JSON.parse(pattern.equalToJson);
          } catch {
            body = pattern.equalToJson;
          }
        }
        bodyPatterns.push({ equalToJson: pattern.equalToJson });
      }

      if (pattern.matchesJsonPath !== undefined) {
        bodyPatterns.push({ matchesJsonPath: pattern.matchesJsonPath });
      }

      if (pattern.matches !== undefined) {
        bodyPatterns.push({ matches: pattern.matches });
      }
    }
  }

  return {
    method,
    ...(url !== undefined ? { url } : {}),
    ...(urlPath !== undefined ? { urlPath } : {}),
    ...(headers !== undefined ? { headers } : {}),
    ...(queryParameters !== undefined ? { queryParameters } : {}),
    ...(body !== undefined ? { body } : {}),
    ...(bodyPatterns.length > 0 ? { bodyPatterns } : {}),
  };
}

function buildResponse(mapping: WireMockMapping, options?: WireMockParseOptions): ContractResponse {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- validated in parseWireMockMapping
  const res = mapping.response!;
  const status = res.status ?? 200;

  // Response headers are simple key-value (unlike request headers which use matchers)
  const headers = res.headers;
  const delayMs = res.fixedDelayMilliseconds;

  // jsonBody takes precedence, then body string, then bodyFileName
  let body: unknown;
  if (res.jsonBody !== undefined) {
    body = res.jsonBody;
  } else if (res.body !== undefined) {
    try {
      body = JSON.parse(res.body);
    } catch {
      body = res.body;
    }
  } else if (res.bodyFileName !== undefined) {
    body = resolveBodyFileName(res.bodyFileName, options);
  }

  return {
    status,
    ...(headers !== undefined ? { headers } : {}),
    ...(body !== undefined ? { body } : {}),
    ...(delayMs !== undefined ? { delayMs } : {}),
  };
}

/**
 * Resolve a bodyFileName to actual file content.
 * When filesDir is provided, reads the file from `filesDir/<bodyFileName>`.
 * Otherwise returns a placeholder string.
 *
 * Security: validates the resolved path stays within filesDir (prevents path traversal).
 */
function resolveBodyFileName(bodyFileName: string, options?: WireMockParseOptions): unknown {
  if (options?.filesDir !== undefined) {
    const resolvedFilesDir = resolve(options.filesDir);
    const filePath = resolve(resolvedFilesDir, bodyFileName);

    // Path traversal guard: resolved path must stay within filesDir
    if (!filePath.startsWith(resolvedFilesDir + sep) && filePath !== resolvedFilesDir) {
      return `[bodyFileName rejected: ${bodyFileName} escapes __files directory]`;
    }

    if (existsSync(filePath)) {
      const content = readFileSync(filePath, "utf-8").replace(/^\uFEFF/, "");
      try {
        return JSON.parse(content);
      } catch {
        return content;
      }
    }
    return `[bodyFileName not found: ${bodyFileName}]`;
  }
  return `[bodyFileName: ${bodyFileName}]`;
}
