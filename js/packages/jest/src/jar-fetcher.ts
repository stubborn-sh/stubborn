import { createWriteStream } from "node:fs";
import { access, readdir, readFile, rm, mkdir } from "node:fs/promises";
import { join, extname } from "node:path";
import { tmpdir } from "node:os";
import { pipeline } from "node:stream/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  parseWireMockMapping,
  parseContract,
  type ParsedContract,
} from "@stubborn-sh/stub-server";

const execFileAsync = promisify(execFile);

const MAX_BFS_DEPTH = 10;

/** Maven coordinates for a stubs JAR. */
export interface MavenStubsJar {
  /** Maven repository URL (e.g., "https://repo1.maven.org/maven2"). */
  readonly repositoryUrl: string;
  /** Group ID (e.g., "com.example"). */
  readonly groupId: string;
  /** Artifact ID (e.g., "order-service"). */
  readonly artifactId: string;
  /** Version (e.g., "1.0.0"). */
  readonly version: string;
  /** Classifier (default: "stubs"). */
  readonly classifier?: string;
  /** Repository authentication. */
  readonly username?: string;
  readonly password?: string;
  readonly token?: string;
}

/**
 * Fetch a Maven stubs JAR, extract it, and parse all contracts/mappings.
 *
 * Extracts WireMock mappings from `mappings/*.json` and falls back to
 * YAML contracts from `contracts/*.yaml` if no mappings are found.
 *
 * Requires `jar` (JDK) or `unzip` on the PATH for extraction.
 */
export async function fetchStubsJar(config: MavenStubsJar): Promise<readonly ParsedContract[]> {
  const jarUrl = buildJarUrl(config);
  const tempDir = join(tmpdir(), `scc-stubs-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const jarPath = join(tempDir, "stubs.jar");

  try {
    await mkdir(tempDir, { recursive: true });
    await downloadFile(jarUrl, jarPath, config);
    await extractJar(jarPath, tempDir);
    return await loadFromExtractedJar(tempDir);
  } finally {
    await rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

/**
 * Load contracts from a local stubs JAR file.
 *
 * Extracts the JAR to a temp directory, parses all contracts/mappings
 * (searching nested `META-INF/` directories if needed), then cleans up.
 *
 * Requires `jar` (JDK) or `unzip` on the PATH for extraction.
 */
export async function loadLocalJar(jarPath: string): Promise<readonly ParsedContract[]> {
  await access(jarPath).catch(() => {
    throw new Error(`Local stubs JAR not found: ${jarPath}`);
  });

  const tempDir = join(
    tmpdir(),
    `scc-stubs-local-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );

  try {
    await mkdir(tempDir, { recursive: true });
    await extractJar(jarPath, tempDir);
    return await loadFromExtractedJar(tempDir);
  } finally {
    await rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

/** Build the Maven repository URL for a stubs JAR. */
export function buildJarUrl(config: MavenStubsJar): string {
  const classifier = config.classifier ?? "stubs";
  const groupPath = config.groupId.replace(/\./g, "/");
  const baseUrl = config.repositoryUrl.replace(/\/+$/, "");
  return `${baseUrl}/${groupPath}/${config.artifactId}/${config.version}/${config.artifactId}-${config.version}-${classifier}.jar`;
}

async function downloadFile(
  url: string,
  destPath: string,
  auth?: { username?: string; password?: string; token?: string },
): Promise<void> {
  const headers: Record<string, string> = {};
  if (auth?.token !== undefined) {
    headers["Authorization"] = `Bearer ${auth.token}`;
  } else if (auth?.username !== undefined && auth?.password !== undefined) {
    headers["Authorization"] =
      `Basic ${Buffer.from(`${auth.username}:${auth.password}`).toString("base64")}`;
  }

  const response = await fetch(url, { headers });

  if (!response.ok) {
    throw new Error(
      `Failed to download stubs JAR from ${url}: ${response.status} ${response.statusText}`,
    );
  }

  if (response.body === null) {
    throw new Error(`Empty response body from ${url}`);
  }

  const fileStream = createWriteStream(destPath);
  await pipeline(response.body, fileStream);
}

async function extractJar(jarPath: string, destDir: string): Promise<void> {
  // Try `jar xf` first (JDK), then fall back to `unzip`
  // Uses execFile (not exec) to avoid shell injection via jarPath/destDir
  try {
    await execFileAsync("jar", ["xf", jarPath], { cwd: destDir });
    return;
  } catch {
    // jar not available, try unzip
  }

  try {
    await execFileAsync("unzip", ["-o", "-q", jarPath, "-d", destDir]);
    return;
  } catch {
    // unzip not available either
  }

  throw new Error(
    "Cannot extract stubs JAR: neither `jar` (JDK) nor `unzip` found on PATH. " +
      "Install a JDK or unzip utility.",
  );
}

async function loadFromExtractedJar(dir: string): Promise<readonly ParsedContract[]> {
  // Prefer WireMock mappings (matches Java Stub Runner behavior)
  // Search root first, then nested META-INF/ directories (SCC Maven plugin layout)
  const mappingsDir = await findNamedDir(dir, "mappings");
  const filesDir = await findNamedDir(dir, "__files");

  if (mappingsDir !== null) {
    const mappings = await loadJsonMappings(mappingsDir, filesDir ?? join(dir, "__files"));
    if (mappings.length > 0) {
      return mappings;
    }
  }

  // Fall back to YAML contracts
  const contractsDir = await findNamedDir(dir, "contracts");
  if (contractsDir !== null) {
    return loadYamlContracts(contractsDir);
  }

  return [];
}

/**
 * Breadth-first search for a named directory under the given base.
 * Checks root level first, then recurses into subdirectories (e.g. META-INF/).
 * Limited to MAX_BFS_DEPTH levels to prevent resource exhaustion.
 */
async function findNamedDir(baseDir: string, targetName: string): Promise<string | null> {
  const queue: Array<{ path: string; depth: number }> = [{ path: baseDir, depth: 0 }];

  while (queue.length > 0) {
    const item = queue.shift();
    if (item === undefined) break;
    const { path: current, depth } = item;
    if (depth > MAX_BFS_DEPTH) {
      continue;
    }

    let entries;
    try {
      entries = await readdir(current, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (entry.isDirectory() && !entry.isSymbolicLink()) {
        if (entry.name === targetName) {
          return join(current, entry.name);
        }
        queue.push({ path: join(current, entry.name), depth: depth + 1 });
      }
    }
  }

  return null;
}

async function loadJsonMappings(dir: string, filesDir: string): Promise<ParsedContract[]> {
  const contracts: ParsedContract[] = [];
  try {
    await walkAndParse(dir, dir, contracts, ".json", (name, content) =>
      parseWireMockMapping(name, content, { filesDir }),
    );
  } catch {
    // Directory doesn't exist — return empty
  }
  return contracts;
}

async function loadYamlContracts(dir: string): Promise<ParsedContract[]> {
  const contracts: ParsedContract[] = [];
  try {
    await walkAndParse(dir, dir, contracts, null, (name, content) => parseContract(name, content));
  } catch {
    // Directory doesn't exist — return empty
  }
  return contracts;
}

async function walkAndParse(
  rootDir: string,
  currentDir: string,
  contracts: ParsedContract[],
  extFilter: string | null,
  parser: (name: string, content: string) => ParsedContract,
): Promise<void> {
  const entries = await readdir(currentDir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(currentDir, entry.name);

    if (entry.isDirectory()) {
      await walkAndParse(rootDir, fullPath, contracts, extFilter, parser);
      continue;
    }

    if (!entry.isFile()) continue;

    const ext = extname(entry.name).toLowerCase();
    if (extFilter !== null && ext !== extFilter) {
      if (ext !== ".yaml" && ext !== ".yml") continue;
    }
    if (extFilter === null && ext !== ".yaml" && ext !== ".yml") continue;

    const name = fullPath.slice(rootDir.length + 1).replace(/\\/g, "/");
    const content = await readFile(fullPath, "utf-8");
    contracts.push(parser(name, content));
  }
}
