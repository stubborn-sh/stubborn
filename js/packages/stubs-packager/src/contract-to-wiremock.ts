import { posix } from "node:path";
import type { ScannedContract } from "@stubborn-sh/publisher";
import { parseContracts } from "@stubborn-sh/stub-server";

/** Options for {@link convertContract} and {@link contractToWireMock}. */
export interface ContractToWireMockOptions {
  /**
   * Reads a file the contract references (`bodyFromFile`, `bodyFromFileAsBytes`,
   * `fileContentFromFileAsBytes`), given its path relative to the contract file; returns
   * undefined when it does not exist. Without it, a contract referencing a file cannot be
   * converted.
   */
  readonly readFile?: (relativePath: string) => Uint8Array | undefined;
}

/** A WireMock mapping generated for one contract. */
export interface WireMockStub {
  /** The mapping's file name as the JVM names it: the contract's name plus `.json`. */
  readonly fileName: string;
  /** The mapping, as JSON. */
  readonly json: string;
}

/** The result of converting one contract file. */
export interface ContractConversion {
  /** One mapping per HTTP contract of the file the JVM generates a stub for. */
  readonly stubs: readonly WireMockStub[];
  /** The files the contracts reference, by their path relative to the contract file. */
  readonly files: ReadonlyMap<string, Uint8Array>;
  /** Contracts the JVM generates no stub for (messaging-only files, ignored contracts), and why. */
  readonly skipped: readonly string[];
}

/**
 * Convert a YAML contract file to the WireMock mappings the JVM (the Maven/Gradle plugins)
 * generates for it: one per HTTP contract (a file can hold several documents, and a document
 * can be a list), with the files the contracts reference read through `options.readFile` and
 * inlined. Messaging contracts and ignored contracts get no mapping. Throws when the JVM would
 * fail the build on the file, or when stub-server cannot reproduce the JVM's mapping.
 */
export function convertContract(
  contract: ScannedContract,
  options?: ContractToWireMockOptions,
): ContractConversion {
  const fileName = posix.basename(contract.contractName);
  const parsed = parseContracts(
    fileName,
    contract.content,
    options?.readFile !== undefined ? { readFile: options.readFile } : undefined,
  );
  const files = new Map<string, Uint8Array>();
  const stubs: WireMockStub[] = [];
  const skipped: string[] = [];
  if (parsed.length === 0) {
    skipped.push(`${contract.contractName}: no HTTP contract (a messaging contract)`);
  }
  const base = fileName.replace(/\.[^.]*$/, "");
  for (const c of parsed) {
    for (const [path, content] of c.files ?? []) files.set(path, content);
    // RecursiveFilesConverter: the contract's name (the YAML `name`, else the JVM's default
    // name, which parseContracts gives a contract of a file holding several) plus `.json`.
    const ownName = c.source?.["name"];
    const name =
      typeof ownName === "string" && ownName.trim() !== ""
        ? ownName
        : parsed.length === 1
          ? base
          : c.name;
    if (c.ignored === true) {
      skipped.push(`${contract.contractName} (${name}): ignored`);
      continue;
    }
    if (c.wireMockMapping === undefined) {
      throw new Error(
        `Cannot convert contract "${name}" of ${contract.contractName} to a WireMock stub: ${(c.unsupportedMatchers ?? []).join("; ")}`,
      );
    }
    stubs.push({
      fileName: `${name.replace(/[/\\]/g, "_")}.json`,
      json: JSON.stringify(c.wireMockMapping, null, 2),
    });
  }
  return { stubs, files, skipped };
}

/**
 * Convert a YAML contract file holding a single HTTP contract to the WireMock mapping the JVM
 * generates for it (see {@link convertContract}). Throws when the file holds no stub or several.
 */
export function contractToWireMock(
  contract: ScannedContract,
  options?: ContractToWireMockOptions,
): string {
  const { stubs } = convertContract(contract, options);
  const [stub] = stubs;
  if (stub === undefined || stubs.length > 1) {
    throw new Error(
      `Contract "${contract.contractName}" generates ${stubs.length} WireMock stubs, not one (use convertContract)`,
    );
  }
  return stub.json;
}
