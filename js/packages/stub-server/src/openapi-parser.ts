import yaml from "js-yaml";
import type { ParsedContract, ContractRequest, ContractResponse } from "./contract-parser.js";

/**
 * Check if YAML/JSON content looks like an OpenAPI specification.
 * Inspects the first non-blank, non-comment line for OpenAPI indicators.
 */
export function looksLikeOpenApi(content: string): boolean {
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("#")) continue;
    return (
      trimmed.startsWith("openapi") ||
      trimmed.startsWith("swagger") ||
      trimmed.startsWith('"openapi"') ||
      trimmed.startsWith('"swagger"') ||
      trimmed.startsWith("{")
    );
  }
  return false;
}

/**
 * Parse an OpenAPI 3.x specification with x-contracts extensions
 * into ParsedContract objects.
 *
 * Each x-contracts entry on an operation produces one ParsedContract,
 * correlated by contractId across parameters, request body, and responses.
 */
export function parseOpenApiContracts(
  fileName: string,
  content: string,
): readonly ParsedContract[] {
  let doc: unknown;
  try {
    doc = yaml.load(content, { schema: yaml.JSON_SCHEMA });
  } catch (err: unknown) {
    throw new Error(
      `Failed to parse OpenAPI YAML "${fileName}": ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  if (typeof doc !== "object" || doc === null) {
    return [];
  }

  const root = doc as RawOpenApi;
  const paths = root.paths;
  if (paths === undefined || paths === null || typeof paths !== "object") {
    return [];
  }

  const contracts: ParsedContract[] = [];

  for (const [pathPattern, pathItem] of Object.entries(paths)) {
    if (pathItem === null || typeof pathItem !== "object") continue;

    for (const method of HTTP_METHODS) {
      const operation = (pathItem as Record<string, unknown>)[method];
      if (operation === null || typeof operation !== "object") continue;

      const op = operation as RawOperation;
      const xContracts = getXContracts(op);
      if (xContracts.length === 0) continue;

      for (const entry of xContracts) {
        if (entry.ignored === true) continue;

        const contractId = entry.contractId;
        if (contractId === undefined) continue;

        const parsed = buildContract(
          pathPattern,
          method.toUpperCase(),
          op,
          entry,
          contractId,
        );
        if (parsed !== null) {
          contracts.push(parsed);
        }
      }
    }
  }

  return contracts;
}

const HTTP_METHODS = ["get", "post", "put", "delete", "patch"] as const;

function buildContract(
  pathPattern: string,
  httpMethod: string,
  operation: RawOperation,
  entry: XContractEntry,
  contractId: unknown,
): ParsedContract | null {
  // Resolve URL path
  const urlPath = resolveUrlPath(pathPattern, operation, entry, contractId);

  // Resolve response
  const responseMatch = findResponse(operation, contractId);
  if (responseMatch === null) return null;

  const { statusCode, xContract: responseXContract } = responseMatch;

  // Build request
  const request = buildRequest(httpMethod, urlPath, operation, entry, contractId);

  // Build response
  const response = buildResponse(statusCode, responseXContract, operation);

  // Contract name
  const name =
    typeof entry.name === "string" && entry.name !== ""
      ? entry.name
      : `${httpMethod} ${pathPattern} #${String(contractId)}`;

  return {
    name,
    request,
    response,
    ...(typeof entry.priority === "number" ? { priority: entry.priority } : {}),
  };
}

function resolveUrlPath(
  pathPattern: string,
  operation: RawOperation,
  entry: XContractEntry,
  contractId: unknown,
): string {
  // contractPath override
  if (typeof entry.contractPath === "string" && entry.contractPath !== "") {
    return entry.contractPath;
  }

  // Replace {param} placeholders with x-contracts values
  let resolved = pathPattern;
  const parameters = operation.parameters ?? [];

  for (const param of parameters) {
    if (param === null || typeof param !== "object") continue;
    if (param.in !== "path") continue;

    const paramName = param.name;
    if (typeof paramName !== "string") continue;

    const paramXContracts = getXContracts(param);
    const matching = paramXContracts.find((x) => x.contractId === contractId);
    if (matching !== undefined && matching.value !== undefined) {
      resolved = resolved.replace(`{${paramName}}`, String(matching.value));
    }
  }

  return resolved;
}

function buildRequest(
  httpMethod: string,
  urlPath: string,
  operation: RawOperation,
  entry: XContractEntry,
  contractId: unknown,
): ContractRequest {
  const headers: Record<string, string> = {};
  const queryParameters: Record<string, string> = {};
  let body: unknown = undefined;

  // Headers from operation-level x-contracts
  if (entry.headers !== undefined && typeof entry.headers === "object") {
    for (const [key, value] of Object.entries(entry.headers as Record<string, unknown>)) {
      if (typeof value === "string") {
        headers[key] = value;
      }
    }
  }

  // Parameters (query + header)
  const parameters = operation.parameters ?? [];
  for (const param of parameters) {
    if (param === null || typeof param !== "object") continue;

    const paramXContracts = getXContracts(param);
    const matching = paramXContracts.find((x) => x.contractId === contractId);
    if (matching === undefined || matching.value === undefined) continue;

    if (param.in === "query" && typeof param.name === "string") {
      queryParameters[param.name] = String(matching.value);
    } else if (param.in === "header" && typeof param.name === "string") {
      headers[param.name] = String(matching.value);
    }
  }

  // Request body
  const requestBody = operation.requestBody;
  if (requestBody !== undefined && requestBody !== null && typeof requestBody === "object") {
    // Content type from requestBody.content
    const rbContent = (requestBody as Record<string, unknown>).content;
    if (rbContent !== undefined && rbContent !== null && typeof rbContent === "object") {
      const mediaTypes = Object.keys(rbContent as Record<string, unknown>);
      if (mediaTypes.length > 0 && headers["Content-Type"] === undefined) {
        headers["Content-Type"] = mediaTypes[0];
      }
    }

    // Body from requestBody x-contracts
    const rbXContracts = getXContracts(requestBody as HasExtensions);
    const matching = rbXContracts.find((x) => x.contractId === contractId);
    if (matching !== undefined && matching.body !== undefined) {
      body = matching.body;
    }
  }

  const result: ContractRequest = {
    method: httpMethod,
    urlPath,
    ...(Object.keys(headers).length > 0 ? { headers } : {}),
    ...(Object.keys(queryParameters).length > 0 ? { queryParameters } : {}),
    ...(body !== undefined ? { body } : {}),
  };

  return result;
}

function buildResponse(
  statusCode: number,
  responseXContract: XContractEntry,
  operation: RawOperation,
): ContractResponse {
  const headers: Record<string, string> = {};

  // Headers from response x-contracts
  if (
    responseXContract.headers !== undefined &&
    typeof responseXContract.headers === "object"
  ) {
    for (const [key, value] of Object.entries(
      responseXContract.headers as Record<string, unknown>,
    )) {
      if (typeof value === "string") {
        headers[key] = value;
      }
    }
  }

  // If no Content-Type in x-contracts headers, derive from response content media type
  if (headers["Content-Type"] === undefined) {
    const responses = operation.responses ?? {};
    const statusKey = String(statusCode);
    const responseObj = responses[statusKey];
    if (
      responseObj !== undefined &&
      responseObj !== null &&
      typeof responseObj === "object"
    ) {
      const content = (responseObj as Record<string, unknown>).content;
      if (content !== undefined && content !== null && typeof content === "object") {
        const mediaTypes = Object.keys(content as Record<string, unknown>);
        if (mediaTypes.length > 0) {
          headers["Content-Type"] = mediaTypes[0];
        }
      }
    }
  }

  return {
    status: statusCode,
    ...(Object.keys(headers).length > 0 ? { headers } : {}),
    ...(responseXContract.body !== undefined ? { body: responseXContract.body } : {}),
  };
}

function findResponse(
  operation: RawOperation,
  contractId: unknown,
): { statusCode: number; xContract: XContractEntry } | null {
  const responses = operation.responses ?? {};

  for (const [statusKey, responseObj] of Object.entries(responses)) {
    const code = parseInt(statusKey, 10);
    if (isNaN(code)) continue;

    if (responseObj === null || typeof responseObj !== "object") continue;

    const xContracts = getXContracts(responseObj as HasExtensions);
    const matching = xContracts.find((x) => x.contractId === contractId);
    if (matching !== undefined) {
      return { statusCode: code, xContract: matching };
    }
  }

  return null;
}

function getXContracts(obj: HasExtensions): readonly XContractEntry[] {
  const raw = obj["x-contracts"];
  if (!Array.isArray(raw)) return [];
  return raw as XContractEntry[];
}

// Raw types for the parsed YAML structure

interface HasExtensions {
  readonly "x-contracts"?: unknown;
}

interface RawOpenApi {
  readonly openapi?: string;
  readonly swagger?: string;
  readonly paths?: Record<string, unknown>;
}

interface RawOperation extends HasExtensions {
  readonly parameters?: readonly RawParameter[];
  readonly requestBody?: unknown;
  readonly responses?: Record<string, unknown>;
}

interface RawParameter extends HasExtensions {
  readonly name?: string;
  readonly in?: string;
}

interface XContractEntry {
  readonly contractId?: unknown;
  readonly name?: string;
  readonly contractPath?: string;
  readonly priority?: number;
  readonly ignored?: boolean;
  readonly headers?: unknown;
  readonly body?: unknown;
  readonly value?: unknown;
  readonly request?: {
    readonly queryParameters?: readonly { key: string; value: string }[];
  };
}
