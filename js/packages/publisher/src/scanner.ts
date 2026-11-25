import { readdir, readFile } from "node:fs/promises";
import { join, posix, relative } from "node:path";
import { detectContentType, knownExtensions } from "./content-type.js";

/** A contract file discovered by the scanner. */
export interface ScannedContract {
  /**
   * Path of the file relative to the scan root, with `/` separators (e.g. `orders/get.yaml`).
   * The publisher publishes it under {@link brokerContractName} of this path.
   */
  readonly contractName: string;
  /** Raw file content as a string. */
  readonly content: string;
  /** Detected content type (e.g., "application/x-spring-cloud-contract+yaml"). */
  readonly contentType: string;
}

/**
 * Recursively scan a directory for contract files, sorted by name as the JVM publisher walks it.
 * Only files with known contract extensions are included, and files that a YAML contract
 * references as a body or multipart file (`bodyFromFile`, `bodyFromFileAsBytes`,
 * `fileContentFromFileAsBytes`, relative to the contract) are left out: they are payloads, not
 * contracts.
 */
export async function scanContracts(directory: string): Promise<readonly ScannedContract[]> {
  const extensions = new Set(knownExtensions());
  const contracts: ScannedContract[] = [];

  await walk(directory, directory, extensions, contracts);

  const referenced = new Set(
    contracts
      .filter((c) => isYaml(c.contractName))
      .flatMap((c) =>
        referencedFiles(c.content).map((path) =>
          posix.normalize(posix.join(posix.dirname(c.contractName), path)),
        ),
      ),
  );
  return contracts.filter((c) => !referenced.has(c.contractName));
}

async function walk(
  rootDir: string,
  currentDir: string,
  extensions: ReadonlySet<string>,
  contracts: ScannedContract[],
): Promise<void> {
  const entries = await readdir(currentDir, { withFileTypes: true });
  entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));

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

function isYaml(path: string): boolean {
  return /\.ya?ml$/i.test(path);
}

const FILE_KEYS = ["bodyFromFile", "bodyFromFileAsBytes", "fileContentFromFileAsBytes"];

/**
 * The files a YAML contract references, as written in it. The keys are found line by line in
 * block style (as contracts are written), so the publisher needs no YAML parser.
 */
function referencedFiles(content: string): string[] {
  const paths: string[] = [];
  for (const line of content.split(/\r?\n/)) {
    let entry = line.trimStart();
    if (entry.startsWith("- ")) entry = entry.slice(2).trimStart();
    for (const key of FILE_KEYS) {
      if (!entry.startsWith(key)) continue;
      const rest = entry.slice(key.length).trimStart();
      if (!rest.startsWith(":")) continue;
      const path = scalar(rest.slice(1).trim());
      if (path !== "") paths.push(path);
    }
  }
  return paths;
}

/** The value of a single-line YAML scalar: quoted, or plain with an optional comment. */
function scalar(value: string): string {
  if (value.startsWith('"')) {
    const end = /^"((?:[^"\\]|\\.)*)"/.exec(value);
    if (end === null) return "";
    try {
      return JSON.parse(`"${end[1] ?? ""}"`) as string;
    } catch {
      return end[1] ?? "";
    }
  }
  if (value.startsWith("'")) {
    const end = /^'((?:[^']|'')*)'/.exec(value);
    return end === null ? "" : (end[1] ?? "").replace(/''/g, "'");
  }
  return value.replace(/[ \t]+#.*$/, "");
}
