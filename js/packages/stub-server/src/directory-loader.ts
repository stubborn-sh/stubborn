import { readdir, readFile } from "node:fs/promises";
import { join, extname } from "node:path";
import type { ParsedContract } from "./contract-parser.js";
import { parseContract } from "./contract-parser.js";
import { parseWireMockMapping, type WireMockParseOptions } from "./wiremock-parser.js";
import { looksLikeOpenApi, parseOpenApiContracts } from "./openapi-parser.js";

/** How to interpret files in the directory. */
export type LoadFormat = "auto" | "contracts" | "wiremock";

/**
 * Load contracts from a local directory.
 *
 * Format detection:
 * - "contracts" — parse .yaml/.yml files as Spring Cloud Contract YAML
 * - "wiremock" — parse .json files as WireMock JSON mappings
 * - "auto" (default) — .yaml/.yml → contracts, .json → WireMock (skips unparseable JSON)
 *
 * @param filesDir - Optional path to `__files/` directory for resolving WireMock `bodyFileName`.
 */
export async function loadFromDirectory(
  directory: string,
  format: LoadFormat = "auto",
  filesDir?: string,
): Promise<readonly ParsedContract[]> {
  const contracts: ParsedContract[] = [];
  const parseOptions: WireMockParseOptions | undefined =
    filesDir !== undefined ? { filesDir } : undefined;
  await walkDir(directory, directory, contracts, format, parseOptions);
  return contracts;
}

async function walkDir(
  rootDir: string,
  currentDir: string,
  contracts: ParsedContract[],
  format: LoadFormat,
  parseOptions?: WireMockParseOptions,
): Promise<void> {
  const entries = await readdir(currentDir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(currentDir, entry.name);

    if (entry.isDirectory()) {
      await walkDir(rootDir, fullPath, contracts, format, parseOptions);
      continue;
    }

    if (!entry.isFile()) continue;

    const ext = extname(entry.name).toLowerCase();
    const name = fullPath.slice(rootDir.length + 1).replace(/\\/g, "/");

    if (isYamlFile(ext) && (format === "contracts" || format === "auto")) {
      const content = await readFile(fullPath, "utf-8");
      if (looksLikeOpenApi(content)) {
        contracts.push(...parseOpenApiContracts(name, content));
      } else {
        contracts.push(parseContract(name, content));
      }
    } else if (ext === ".json" && (format === "wiremock" || format === "auto")) {
      const content = await readFile(fullPath, "utf-8");
      if (format === "wiremock") {
        contracts.push(parseWireMockMapping(name, content, parseOptions));
      } else {
        try {
          contracts.push(parseWireMockMapping(name, content, parseOptions));
        } catch {
          // Not a WireMock mapping — skip
        }
      }
    }
  }
}

function isYamlFile(ext: string): boolean {
  return ext === ".yaml" || ext === ".yml";
}
