import { readFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import type { MessagingContract } from "./types.js";
import { parseMessagingContracts } from "./contract-parser.js";

/**
 * Reads the files a contract references (`bodyFromFile`, `bodyFromFileAsBytes`) relative to the
 * contract file, as the JVM does. Returns undefined when a file cannot be read.
 */
export function contractFileReader(
  contractPath: string,
): (relativePath: string) => Uint8Array | undefined {
  const directory = dirname(contractPath);
  return (relativePath) => {
    try {
      return readFileSync(resolve(directory, relativePath));
    } catch {
      return undefined;
    }
  };
}

/**
 * Read every messaging contract in a YAML contract file, with the files it references read
 * relative to it. Contracts are named after the file as the JVM names them.
 */
export function loadMessagingContractFile(contractPath: string): MessagingContract[] {
  const content = readFileSync(contractPath, "utf-8");
  return parseMessagingContracts(basename(contractPath), content, {
    readFile: contractFileReader(contractPath),
  });
}
