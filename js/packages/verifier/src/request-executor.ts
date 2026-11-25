import type { ParsedContract } from "@stubborn-sh/stub-server";

/** Response from executing a contract request against a provider. */
export interface ExecutionResult {
  readonly status: number;
  readonly headers: Readonly<Record<string, string>>;
  /** The body: parsed when the response says it is JSON, else its text; undefined when empty. */
  readonly body: unknown;
  /** The body as text, as received. */
  readonly bodyText?: string;
  /** The body as bytes, when the fetch implementation offers them. */
  readonly bodyBytes?: Uint8Array;
  /** Cookies the response sets (`Set-Cookie`), by name. */
  readonly cookies?: Readonly<Record<string, string>>;
}

/** Default request timeout in milliseconds. */
const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * Execute a contract's request against a real provider and return the response.
 *
 * The request is the one the JVM-generated test sends: the URL with the contract's
 * `queryParameters` appended, its headers and `cookies`, and its body — including a
 * `bodyFromFile`/`bodyFromFileAsBytes` body, read from {@link ParsedContract.files}.
 */
export async function executeRequest(
  baseUrl: string,
  contract: ParsedContract,
  fetchFn: typeof globalThis.fetch = globalThis.fetch,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<ExecutionResult> {
  const raw = section(contract.source, "request");
  const url = withQuery(contract.request.url ?? contract.request.urlPath ?? "/", contract, raw);

  const headers: Record<string, string> = {};
  const rawHeaders = record(raw?.["headers"]) ?? contract.request.headers;
  if (rawHeaders !== undefined) {
    for (const [key, value] of Object.entries(rawHeaders)) {
      headers[key] = Array.isArray(value) ? value.map(text).join(", ") : text(value);
    }
  }

  const cookies = record(raw?.["cookies"]);
  if (cookies !== undefined && Object.keys(cookies).length > 0) {
    const pairs = Object.entries(cookies).map(([k, v]) => `${k}=${text(v)}`);
    const existing = headerName(headers, "Cookie");
    if (existing !== undefined) headers[existing] = [headers[existing], ...pairs].join("; ");
    else headers["Cookie"] = pairs.join("; ");
  }

  const body = requestBody(contract, raw, headers);

  const response = await fetchFn(`${baseUrl}${url}`, {
    method: contract.request.method,
    headers,
    body,
    signal: AbortSignal.timeout(timeoutMs),
  });

  const responseHeaders: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    responseHeaders[key] = value;
  });

  let bytes: Uint8Array | undefined;
  let bodyText: string;
  const reader = response as Partial<Pick<Response, "arrayBuffer">>;
  if (typeof reader.arrayBuffer === "function") {
    bytes = new Uint8Array(await reader.arrayBuffer.call(response));
    bodyText = new TextDecoder().decode(bytes);
  } else {
    bodyText = await response.text();
  }

  let parsed: unknown = undefined;
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("json") && bodyText !== "") {
    try {
      parsed = JSON.parse(bodyText) as unknown;
    } catch {
      parsed = bodyText;
    }
  } else if (bodyText !== "") {
    parsed = bodyText;
  }

  return {
    status: response.status,
    headers: responseHeaders,
    body: parsed,
    bodyText,
    ...(bytes !== undefined ? { bodyBytes: bytes } : {}),
    cookies: responseCookies(response.headers),
  };
}

/**
 * The request body. A structured (object/array) body is sent as JSON, with
 * `Content-Type: application/json` unless the contract sets one; a string body is sent as written
 * with only the contract's headers, as the JVM test does.
 */
function requestBody(
  contract: ParsedContract,
  raw: Record<string, unknown> | undefined,
  headers: Record<string, string>,
): string | Uint8Array | undefined {
  for (const key of ["bodyFromFile", "bodyFromFileAsBytes"]) {
    const path = raw?.[key];
    if (typeof path !== "string") continue;
    const content = contract.files?.get(path);
    if (content === undefined) {
      throw new Error(
        `Contract "${contract.name}": the request ${key} "${path}" was not found next to the contract`,
      );
    }
    return content;
  }
  const body = raw !== undefined && "body" in raw ? raw["body"] : contract.request.body;
  if (body === undefined || body === null) return undefined;
  if (typeof body === "string") return body;
  if (typeof body === "object") {
    if (headerName(headers, "Content-Type") === undefined) {
      headers["Content-Type"] = "application/json";
    }
    return JSON.stringify(body);
  }
  return text(body);
}

/**
 * Append the contract's `queryParameters` (a list value sends the parameter once per value), as
 * the JVM test's `.queryParam(name, value)` calls do. A parameter whose request matcher is
 * `absent` is not sent.
 */
function withQuery(
  url: string,
  contract: ParsedContract,
  raw: Record<string, unknown> | undefined,
): string {
  const params = record(raw?.["queryParameters"]) ?? contract.request.queryParameters;
  if (params === undefined) return url;
  const absent = new Set<string>();
  const matchers = record(raw?.["matchers"])?.["queryParameters"];
  if (Array.isArray(matchers)) {
    for (const m of matchers) {
      const matcher = record(m);
      if (matcher?.["type"] === "absent" && typeof matcher["key"] === "string") {
        absent.add(matcher["key"]);
      }
    }
  }
  const pairs: string[] = [];
  for (const [key, value] of Object.entries(params)) {
    if (absent.has(key)) continue;
    for (const v of Array.isArray(value) ? (value as unknown[]) : [value]) {
      pairs.push(`${encodeURIComponent(key)}=${encodeURIComponent(text(v))}`);
    }
  }
  if (pairs.length === 0) return url;
  return `${url}${url.includes("?") ? "&" : "?"}${pairs.join("&")}`;
}

/** Cookies from `Set-Cookie` headers: the name and value before the first `;`. */
function responseCookies(headers: Headers): Record<string, string> {
  const withSetCookie = headers as Headers & { getSetCookie?: () => string[] };
  const lines =
    typeof withSetCookie.getSetCookie === "function"
      ? withSetCookie.getSetCookie()
      : (headers.get("set-cookie") ?? "").split(/,(?=\s*[^;,=\s]+=)/);
  const cookies: Record<string, string> = {};
  for (const line of lines) {
    const pair = line.split(";")[0] ?? "";
    const eq = pair.indexOf("=");
    if (eq <= 0) continue;
    const name = pair.slice(0, eq).trim();
    if (!Object.hasOwn(cookies, name)) cookies[name] = pair.slice(eq + 1).trim();
  }
  return cookies;
}

function headerName(headers: Record<string, string>, name: string): string | undefined {
  return Object.keys(headers).find((k) => k.toLowerCase() === name.toLowerCase());
}

/** The `request` or `response` section of the contract's YAML document. */
export function section(
  source: ParsedContract["source"],
  name: "request" | "response",
): Record<string, unknown> | undefined {
  return record(source?.[name]);
}

export function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function text(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value) ?? "";
}
