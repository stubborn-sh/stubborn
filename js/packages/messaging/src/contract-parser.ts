import * as yaml from "js-yaml";
import type { MessageDirection, MessagingContract } from "./types.js";

interface RawMessagingContract {
  name?: unknown;
  description?: string;
  label?: string;
  input?: {
    triggeredBy?: string;
    /**
     * JS-only extension (SUBSCRIBE direction). The Stubborn / Spring Cloud Contract YAML model
     * has no `input.messageFrom` (`YamlContract.Input` holds only `triggeredBy` and
     * `assertThat`), and the JVM rejects a contract that uses it, as an unknown property.
     */
    messageFrom?: string;
  };
  outputMessage?: {
    sentTo?: string;
    headers?: Record<string, unknown>;
    body?: unknown;
    bodyFromFile?: unknown;
    bodyFromFileAsBytes?: unknown;
  };
  request?: unknown;
  response?: unknown;
}

/** Options for {@link parseMessagingContracts} and {@link parseMessagingContract}. */
export interface ParseMessagingContractOptions {
  /**
   * Reads a file a contract references (`outputMessage.bodyFromFile` or
   * `outputMessage.bodyFromFileAsBytes`), given its path as written in the contract, which is
   * relative to the contract file. Returns undefined when the file cannot be read. Without it,
   * a contract with a file body has no body and {@link messageBody} reports the missing file.
   */
  readonly readFile?: (relativePath: string) => Uint8Array | undefined;
}

/**
 * Detect whether a YAML string holds a messaging contract: whether any of its documents (or
 * contracts in a list document) has `outputMessage.sentTo` or `input.messageFrom`.
 */
export function isMessagingContract(yamlContent: string): boolean {
  let documents: unknown[];
  try {
    documents = yaml.loadAll(yamlContent, undefined, { schema: yaml.JSON_SCHEMA });
  } catch {
    return false;
  }
  return documents.some((document) =>
    (Array.isArray(document) ? document : [document]).some(isMessagingDocument),
  );
}

function isMessagingDocument(document: unknown): boolean {
  if (typeof document !== "object" || document === null || Array.isArray(document)) {
    return false;
  }
  const contract = document as RawMessagingContract;
  return contract.outputMessage?.sentTo !== undefined || contract.input?.messageFrom !== undefined;
}

/**
 * Parse a YAML file that holds a single messaging contract into a {@link MessagingContract}.
 * See {@link parseMessagingContracts} for the patterns supported and how contracts are named.
 *
 * Throws if the contract is not a valid messaging contract, or if the file holds more or fewer
 * than one messaging contract.
 */
export function parseMessagingContract(
  name: string,
  yamlContent: string,
  options?: ParseMessagingContractOptions,
): MessagingContract {
  const contracts = parseMessagingContracts(name, yamlContent, options);
  if (contracts.length !== 1) {
    throw new Error(
      `Messaging contract "${name}" holds ${contracts.length} messaging contracts, not one`,
    );
  }
  return contracts[0] as MessagingContract;
}

/**
 * Parse every messaging contract in a YAML contract file. As on the JVM, a file can hold several
 * documents (`---`) and a document can be a list of contracts; documents without a messaging
 * part (HTTP contracts) are skipped. Two patterns are supported:
 * - Producer: `outputMessage.sentTo` (+ `input.triggeredBy`) → PUBLISH direction
 * - Consumer: `input.messageFrom` → SUBSCRIBE direction. This is a JS-only extension: the JVM
 *   YAML model has no `messageFrom` and rejects a contract that uses it.
 *
 * A contract is named as the JVM names it (`NamesUtil.defaultContractName`): its own `name`,
 * else the file name without its directory and `.yaml`/`.yml` extension, followed by
 * `_<document index>` when the file holds more than one document or the document is a list of
 * several contracts.
 *
 * The body is `outputMessage.bodyFromFileAsBytes` (bytes), else `outputMessage.bodyFromFile`
 * (text, its lines joined with `\n` as the JVM reads it), else `outputMessage.body`; files are
 * read through {@link ParseMessagingContractOptions.readFile}.
 */
export function parseMessagingContracts(
  name: string,
  yamlContent: string,
  options?: ParseMessagingContractOptions,
): MessagingContract[] {
  let documents: unknown[];
  try {
    documents = yaml.loadAll(yamlContent, undefined, { schema: yaml.JSON_SCHEMA });
  } catch (err: unknown) {
    throw new Error(
      `Failed to parse YAML for messaging contract "${name}": ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  const nonEmpty = documents.filter((d) => d !== null && d !== undefined);
  if (nonEmpty.length === 0) {
    throw new Error(`Messaging contract "${name}" is not a valid object`);
  }
  const base = defaultBaseName(name);
  const contracts: MessagingContract[] = [];
  nonEmpty.forEach((document, counter) => {
    const items = Array.isArray(document) ? (document as unknown[]) : [document];
    for (const item of items) {
      if (typeof item !== "object" || item === null || Array.isArray(item)) {
        throw new Error(`Messaging contract "${name}" is not a valid object`);
      }
      const raw = item as RawMessagingContract;
      if (raw.request !== undefined || raw.response !== undefined) continue; // HTTP contract
      const ownName = typeof raw.name === "string" ? raw.name.trim() : "";
      const contractName =
        ownName !== ""
          ? ownName
          : base + (counter > 0 || items.length > 1 ? `_${String(counter)}` : "");
      contracts.push(parseDocument(contractName, raw, options));
    }
  });
  return contracts;
}

/**
 * The payload to send for a messaging contract. Throws when the contract's body comes from a
 * file (`bodyFromFile`, `bodyFromFileAsBytes`) that could not be read, rather than sending an
 * empty or `null` message.
 */
export function messageBody(contract: MessagingContract): unknown {
  if (contract.unreadableFile !== undefined) {
    throw new Error(
      `Messaging contract "${contract.name}" cannot be sent: ${contract.unreadableFile}`,
    );
  }
  return contract.body;
}

/**
 * The name the JVM gives a contract with no `name` of its own: the file name without its
 * directory and extension. Contract names from the broker carry no extension (the JVM
 * downloader adds `.yaml`), so only a `.yaml` / `.yml` extension is removed.
 */
function defaultBaseName(name: string): string {
  const fileName = name.slice(Math.max(name.lastIndexOf("/"), name.lastIndexOf("\\")) + 1);
  return fileName.replace(/\.ya?ml$/, "");
}

function parseDocument(
  name: string,
  contract: RawMessagingContract,
  options: ParseMessagingContractOptions | undefined,
): MessagingContract {
  const { destination, direction, triggeredBy } = extractDestinationAndDirection(name, contract);

  const headers = extractHeaders(contract);
  const { body, unreadableFile } = extractBody(contract, options);
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
    ...(unreadableFile !== undefined ? { unreadableFile } : {}),
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

function extractBody(
  contract: RawMessagingContract,
  options: ParseMessagingContractOptions | undefined,
): { body: unknown; unreadableFile?: string } {
  const output = contract.outputMessage;
  // As the JVM maps it: bodyFromFileAsBytes overrides bodyFromFile, which overrides body.
  if (typeof output?.bodyFromFileAsBytes === "string") {
    return readBodyFile("bodyFromFileAsBytes", output.bodyFromFileAsBytes, options, (b) => b);
  }
  if (typeof output?.bodyFromFile === "string") {
    return readBodyFile("bodyFromFile", output.bodyFromFile, options, javaTextFile);
  }
  return { body: output?.body ?? null };
}

function readBodyFile(
  key: string,
  path: string,
  options: ParseMessagingContractOptions | undefined,
  convert: (content: Uint8Array) => unknown,
): { body: unknown; unreadableFile?: string } {
  const unreadable = (reason: string): { body: null; unreadableFile: string } => ({
    body: null,
    unreadableFile: `${key} "${path}" ${reason}`,
  });
  if (options?.readFile === undefined) {
    return unreadable("cannot be read: no file reader was given for this contract");
  }
  let content: Uint8Array | undefined;
  try {
    content = options.readFile(path);
  } catch (err: unknown) {
    return unreadable(`cannot be read: ${err instanceof Error ? err.message : String(err)}`);
  }
  if (content === undefined) {
    return unreadable("is not present next to the contract");
  }
  try {
    return { body: convert(content) };
  } catch {
    return unreadable("is not valid UTF-8 text");
  }
}

/** A text file as the JVM reads it: UTF-8, its lines joined with `\n` (`readAllLines`). */
function javaTextFile(content: Uint8Array): string {
  const text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(content);
  return text.replace(/\r\n?/g, "\n").replace(/\n$/, "");
}
