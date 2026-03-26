import type { ContractResponse } from "./contract-parser.js";

/** Built HTTP response ready to send. */
export interface BuiltResponse {
  readonly status: number;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: string | null;
}

/**
 * Build an HTTP response from a parsed contract response.
 */
export function buildResponse(contractResponse: ContractResponse): BuiltResponse {
  const headers: Record<string, string> = {};

  if (contractResponse.headers !== undefined) {
    for (const [key, value] of Object.entries(contractResponse.headers)) {
      headers[key] = value;
    }
  }

  let body: string | null = null;

  if (contractResponse.body !== undefined) {
    if (typeof contractResponse.body === "string") {
      body = contractResponse.body;
    } else {
      body = JSON.stringify(contractResponse.body);
      if (headers["Content-Type"] === undefined) {
        headers["Content-Type"] = "application/json";
      }
    }
  }

  return {
    status: contractResponse.status,
    headers,
    body,
  };
}
