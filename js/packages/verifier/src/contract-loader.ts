import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { BrokerClient } from "@stubborn-sh/broker-client";
import { parseContract, type ParsedContract } from "@stubborn-sh/stub-server";
import { fetchAllPages } from "@stubborn-sh/broker-client";

/** Load contracts from a local directory. */
export async function loadFromDirectory(directory: string): Promise<readonly ParsedContract[]> {
  const contracts: ParsedContract[] = [];
  await walkDir(directory, directory, contracts);
  return contracts;
}

async function walkDir(
  rootDir: string,
  currentDir: string,
  contracts: ParsedContract[],
): Promise<void> {
  const entries = await readdir(currentDir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(currentDir, entry.name);

    if (entry.isDirectory()) {
      await walkDir(rootDir, fullPath, contracts);
      continue;
    }

    if (!entry.isFile()) continue;
    if (!entry.name.endsWith(".yaml") && !entry.name.endsWith(".yml")) continue;

    const content = await readFile(fullPath, "utf-8");
    const name = fullPath.slice(rootDir.length + 1).replace(/\\/g, "/");
    contracts.push(parseContract(name, content));
  }
}

/** Load contracts from the broker API. */
export async function loadFromBroker(
  client: BrokerClient,
  applicationName: string,
  version: string,
): Promise<readonly ParsedContract[]> {
  const contracts = await fetchAllPages((params) =>
    client.listContracts(applicationName, version, params),
  );

  return contracts
    .filter((c) => c.contentType === "application/x-yaml")
    .map((c) => parseContract(c.contractName, c.content));
}
