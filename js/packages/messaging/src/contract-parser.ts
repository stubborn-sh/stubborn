import * as yaml from "js-yaml";
import type { MessageDirection, MessagingContract } from "./types.js";

interface RawMessagingContract {
  description?: string;
  label?: string;
  input?: {
    triggeredBy?: string;
    messageFrom?: string;
  };
  outputMessage?: {
    sentTo?: string;
    headers?: Record<string, unknown>;
    body?: unknown;
  };
  request?: unknown;
  response?: unknown;
}

/**
 * Detect whether a YAML string represents a messaging contract.
 * Returns true if the contract has `outputMessage.sentTo` or `input.messageFrom`.
 */
export function isMessagingContract(yamlContent: string): boolean {
  let raw: unknown;
  try {
    raw = yaml.load(yamlContent, { schema: yaml.JSON_SCHEMA });
  } catch {
    return false;
  }
  if (typeof raw !== "object" || raw === null) {
    return false;
  }
  const contract = raw as RawMessagingContract;
  return contract.outputMessage?.sentTo !== undefined || contract.input?.messageFrom !== undefined;
}

/**
 * Parse a YAML messaging contract into a {@link MessagingContract}.
 * Supports two SCC messaging patterns:
 * - Producer: `outputMessage.sentTo` + `input.triggeredBy` → PUBLISH direction
 * - Consumer: `input.messageFrom` + `outputMessage` → SUBSCRIBE direction
 *
 * Throws if the contract is not a valid messaging contract.
 */
export function parseMessagingContract(name: string, yamlContent: string): MessagingContract {
  let raw: unknown;
  try {
    raw = yaml.load(yamlContent, { schema: yaml.JSON_SCHEMA });
  } catch (err: unknown) {
    throw new Error(
      `Failed to parse YAML for messaging contract "${name}": ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  if (typeof raw !== "object" || raw === null) {
    throw new Error(`Messaging contract "${name}" is not a valid object`);
  }

  const contract = raw as RawMessagingContract;

  const { destination, direction, triggeredBy } = extractDestinationAndDirection(name, contract);

  const headers = extractHeaders(contract);
  const body = extractBody(contract);
  const description = contract.description ?? "";
  const label = contract.label ?? name;

  return {
    name,
    description,
    label,
    destination,
    direction,
    headers,
    body,
    ...(triggeredBy !== undefined ? { triggeredBy } : {}),
  };
}

function extractDestinationAndDirection(
  name: string,
  contract: RawMessagingContract,
): { destination: string; direction: MessageDirection; triggeredBy?: string } {
  if (contract.outputMessage?.sentTo !== undefined && contract.input?.triggeredBy !== undefined) {
    return {
      destination: contract.outputMessage.sentTo,
      direction: "PUBLISH",
      triggeredBy: contract.input.triggeredBy,
    };
  }

  if (contract.input?.messageFrom !== undefined) {
    return {
      destination: contract.input.messageFrom,
      direction: "SUBSCRIBE",
    };
  }

  if (contract.outputMessage?.sentTo !== undefined) {
    return {
      destination: contract.outputMessage.sentTo,
      direction: "PUBLISH",
    };
  }

  throw new Error(
    `Messaging contract "${name}" must have either "outputMessage.sentTo" or "input.messageFrom"`,
  );
}

function extractHeaders(contract: RawMessagingContract): Readonly<Record<string, string>> {
  const rawHeaders = contract.outputMessage?.headers;
  if (rawHeaders === undefined) {
    return {};
  }
  const headers: Record<string, string> = {};
  for (const [key, value] of Object.entries(rawHeaders)) {
    headers[key] = String(value);
  }
  return headers;
}

function extractBody(contract: RawMessagingContract): unknown {
  return contract.outputMessage?.body ?? null;
}
