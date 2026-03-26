import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { detectContentType, knownExtensions } from "./content-type.js";

/** A contract file discovered by the scanner. */
export interface ScannedContract {
  /** Relative path from the scan root (used as contractName). */
  readonly contractName: string;
  /** Raw file content as a string. */
  readonly content: string;
  /** Detected content type (e.g., "application/x-yaml"). */
  readonly contentType: string;
}

/**
 * Recursively scan a directory for contract files.
 * Only files with known contract extensions are included.
 */
export async function scanContracts(directory: string): Promise<readonly ScannedContract[]> {
  const extensions = new Set(knownExtensions());
  const contracts: ScannedContract[] = [];

  await walk(directory, directory, extensions, contracts);

  return contracts;
}

async function walk(
  rootDir: string,
  currentDir: string,
  extensions: ReadonlySet<string>,
  contracts: ScannedContract[],
): Promise<void> {
  const entries = await readdir(currentDir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(currentDir, entry.name);

    if (entry.isDirectory()) {
      await walk(rootDir, fullPath, extensions, contracts);
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    const contentType = detectContentType(entry.name);
    if (contentType === null) {
      continue;
    }

    const content = await readFile(fullPath, "utf-8");
    const contractName = relative(rootDir, fullPath).replace(/\\/g, "/");

    contracts.push({ contractName, content, contentType });
  }
}
