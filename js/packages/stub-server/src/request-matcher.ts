import { isDeepStrictEqual } from "node:util";
import type { ParsedContract, RequestBodyPattern } from "./contract-parser.js";
import { matchesJsonPath } from "./json-path.js";

/** Result of matching a request against contracts. */
export interface MatchResult {
  readonly matched: boolean;
  readonly contract: ParsedContract | null;
}

/**
 * Match an incoming HTTP request against a list of parsed contracts.
 * Returns the first matching contract, or null if none match.
 *
 * @param rawBody - The raw request body string (needed for regex `matches` patterns).
 */
export function matchRequest(
  method: string,
  url: string,
  headers: Readonly<Record<string, string>>,
  body: unknown,
  contracts: readonly ParsedContract[],
  rawBody?: string,
): MatchResult {
  for (const contract of contracts) {
    if (matchesSingle(method, url, headers, body, rawBody, contract)) {
      return { matched: true, contract };
    }
  }
  return { matched: false, contract: null };
}

function matchesSingle(
  method: string,
  url: string,
  headers: Readonly<Record<string, string>>,
  body: unknown,
  rawBody: string | undefined,
  contract: ParsedContract,
): boolean {
  // Match method
  if (method.toUpperCase() !== contract.request.method) {
    return false;
  }

  // Match URL
  const parsedUrl = new URL(url, "http://localhost");
  const requestPath = normalizePath(safeDecodeURI(parsedUrl.pathname));

  if (contract.request.url !== undefined) {
    if (!matchUrl(requestPath, parsedUrl, contract.request.url)) {
      return false;
    }
  } else if (contract.request.urlPath !== undefined) {
    if (!matchUrlPath(requestPath, contract.request.urlPath)) {
      return false;
    }
  }

  // Match query parameters if specified (order-independent)
  if (contract.request.queryParameters !== undefined) {
    for (const [key, value] of Object.entries(contract.request.queryParameters)) {
      const actual = parsedUrl.searchParams.getAll(key);
      if (actual.length === 0 || !actual.includes(value)) {
        return false;
      }
    }
  }

  // Match headers if specified (case-insensitive keys)
  if (contract.request.headers !== undefined) {
    for (const [key, value] of Object.entries(contract.request.headers)) {
      const lowerKey = key.toLowerCase();
      const headerValue = Object.entries(headers).find(([k]) => k.toLowerCase() === lowerKey)?.[1];
      if (headerValue === undefined) {
        return false;
      }
      // Support exact match and "contains" (header value may include charset, etc.)
      if (headerValue !== value && !headerValue.startsWith(value)) {
        return false;
      }
    }
  }

  // Match body patterns (AND logic — all must match)
  if (contract.request.bodyPatterns !== undefined && contract.request.bodyPatterns.length > 0) {
    if (!matchBodyPatterns(body, rawBody, contract.request.bodyPatterns)) {
      return false;
    }
  } else if (contract.request.body !== undefined) {
    // Fallback: simple deep equality when no bodyPatterns
    if (!isDeepStrictEqual(body, contract.request.body)) {
      return false;
    }
  }

  return true;
}

/**
 * Match full URL (path + query string). Supports regex patterns.
 */
function matchUrl(requestPath: string, parsedUrl: URL, contractUrl: string): boolean {
  // Check for regex first — regex patterns should not be URL-parsed (brackets get mangled)
  if (isRegexPattern(contractUrl)) {
    const fullRequestUrl = requestPath + parsedUrl.search;
    return matchRegex(fullRequestUrl, contractUrl);
  }

  const contractParsed = tryParseUrl(contractUrl);

  if (contractParsed === null) {
    // Not a valid URL and not regex — try exact match
    return requestPath === normalizePath(contractUrl);
  }

  const contractPath = normalizePath(safeDecodeURI(contractParsed.pathname));

  if (requestPath !== contractPath) {
    return false;
  }

  // If contract URL has query params, verify they're present in request
  for (const [key, value] of contractParsed.searchParams.entries()) {
    if (parsedUrl.searchParams.get(key) !== value) {
      return false;
    }
  }

  return true;
}

/**
 * Match URL path only (no query string). Supports regex patterns.
 */
function matchUrlPath(requestPath: string, contractUrlPath: string): boolean {
  if (isRegexPattern(contractUrlPath)) {
    return matchRegex(requestPath, contractUrlPath);
  }

  const normalizedContract = normalizePath(safeDecodeURI(contractUrlPath));
  return requestPath === normalizedContract;
}

/**
 * Heuristic: treat a string as regex if it contains regex-specific characters
 * that wouldn't appear in a normal URL path/query string.
 *
 * Excludes `?` and `$` (common in URLs) — focuses on character classes, groups,
 * quantifiers, and alternation which are unambiguous regex indicators.
 */
function isRegexPattern(value: string): boolean {
  return /[[\]{}()*+\\|^]/.test(value);
}

/**
 * Match a value against a regex pattern. The pattern is anchored (full match).
 * Uses `s` (dotAll) flag so `.` matches newlines — needed for multipart body matching.
 */
function matchRegex(value: string, pattern: string): boolean {
  try {
    const regex = new RegExp(`^${pattern}$`, "s");
    return regex.test(value);
  } catch {
    // Invalid regex — fall back to exact match
    return value === pattern;
  }
}

/**
 * Try to parse a string as a URL. Returns null if it can't be parsed.
 */
function tryParseUrl(value: string): URL | null {
  try {
    return new URL(value, "http://localhost");
  } catch {
    return null;
  }
}

/**
 * Decode URI component, returning the original string if decoding fails
 * (e.g., for malformed percent-encoded sequences like bare `%`).
 */
function safeDecodeURI(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/**
 * Normalize a URL path: remove trailing slash (except for root "/").
 */
function normalizePath(path: string): string {
  if (path.length > 1 && path.endsWith("/")) {
    return path.slice(0, -1);
  }
  return path;
}

// --- Body pattern matching (matchesJsonPath, matches, equalToJson) ---

/**
 * Match all body patterns against the request body. ALL must match (AND logic).
 */
function matchBodyPatterns(
  body: unknown,
  rawBody: string | undefined,
  patterns: readonly RequestBodyPattern[],
): boolean {
  for (const pattern of patterns) {
    if (pattern.equalToJson !== undefined) {
      let expected: unknown;
      try {
        expected = JSON.parse(pattern.equalToJson);
      } catch {
        expected = pattern.equalToJson;
      }
      if (!isDeepStrictEqual(body, expected)) {
        return false;
      }
    }

    if (pattern.matchesJsonPath !== undefined) {
      if (!matchesJsonPathPattern(body, pattern.matchesJsonPath)) {
        return false;
      }
    }

    if (pattern.matches !== undefined) {
      // Regex match against the raw body string
      const bodyStr = rawBody ?? (body !== undefined ? JSON.stringify(body) : "");
      if (!matchRegex(bodyStr, pattern.matches)) {
        return false;
      }
    }
  }

  return true;
}

/**
 * WireMock `matchesJsonPath`: evaluated against a JSON object or array body only.
 */
function matchesJsonPathPattern(body: unknown, expression: string): boolean {
  if (typeof body !== "object" || body === null) {
    return false;
  }
  return matchesJsonPath(body, expression);
}
