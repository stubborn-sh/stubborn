import type { ParsedContract } from "@stubborn-sh/stub-server";

/** Response from executing a contract request against a provider. */
export interface ExecutionResult {
  readonly status: number;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: unknown;
}

/** Default request timeout in milliseconds. */
const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * Execute a contract's request against a real provider and return the response.
 */
export async function executeRequest(
  baseUrl: string,
  contract: ParsedContract,
  fetchFn: typeof globalThis.fetch = globalThis.fetch,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<ExecutionResult> {
  const url = contract.request.url ?? contract.request.urlPath ?? "/";
  const fullUrl = `${baseUrl}${url}`;

  const headers: Record<string, string> = {};
  if (contract.request.headers !== undefined) {
    Object.assign(headers, contract.request.headers);
  }

  let bodyStr: string | undefined;
  if (contract.request.body !== undefined) {
    bodyStr =
      typeof contract.request.body === "string"
        ? contract.request.body
        : JSON.stringify(contract.request.body);
    if (headers["Content-Type"] === undefined) {
      headers["Content-Type"] = "application/json";
    }
  }

  const response = await fetchFn(fullUrl, {
    method: contract.request.method,
    headers,
    body: bodyStr,
    signal: AbortSignal.timeout(timeoutMs),
  });

  const responseHeaders: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    responseHeaders[key] = value;
  });

  let body: unknown = undefined;
  const text = await response.text();
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("json") && text !== "") {
    try {
      body = JSON.parse(text) as unknown;
    } catch {
      body = text;
    }
  } else if (text !== "") {
    body = text;
  }

  return {
    status: response.status,
    headers: responseHeaders,
    body,
  };
}
