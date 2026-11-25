import type { ContractResponse } from "./contract-parser.js";
import { isTemplate, renderTemplate, type TemplateRequest } from "./response-template.js";

/** Built HTTP response ready to send. */
export interface BuiltResponse {
  readonly status: number;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: string | Uint8Array | null;
}

/**
 * Build an HTTP response from a parsed contract response.
 *
 * When the response asks for templating ({@link ContractResponse.responseTemplating}) and the
 * incoming `request` is given, the body and header values are rendered against it the way
 * WireMock's `response-template` transformer does. Throws a `ResponseTemplateError` when a
 * template uses syntax or helpers that are not supported.
 */
export function buildResponse(
  contractResponse: ContractResponse,
  request?: TemplateRequest,
): BuiltResponse {
  const render =
    contractResponse.responseTemplating === true && request !== undefined
      ? (text: string): string => (isTemplate(text) ? renderTemplate(text, request) : text)
      : (text: string): string => text;

  const headers: Record<string, string> = {};

  if (contractResponse.headers !== undefined) {
    for (const [key, value] of Object.entries(contractResponse.headers)) {
      // A WireMock header with several values is an array.
      const values: unknown = value;
      headers[key] = Array.isArray(values)
        ? (values.map((v) => render(String(v))) as unknown as string)
        : render(value);
    }
  }

  let body: string | Uint8Array | null = null;

  if (contractResponse.rawBody !== undefined) {
    // Served as is, like WireMock: no re-serialization and no Content-Type added.
    const raw = contractResponse.rawBody;
    body = typeof raw === "string" ? render(raw) : raw;
  } else if (contractResponse.body !== undefined) {
    if (typeof contractResponse.body === "string") {
      body = render(contractResponse.body);
    } else {
      body = render(JSON.stringify(contractResponse.body));
      if (!Object.keys(headers).some((key) => key.toLowerCase() === "content-type")) {
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
