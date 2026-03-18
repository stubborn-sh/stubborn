import { createWriteStream } from "node:fs";
import { extname } from "node:path";
import archiver from "archiver";
import { scanContracts } from "@spring-cloud-contract/publisher";
import { contractToWireMock } from "./contract-to-wiremock.js";

/** Maven coordinates for the stubs JAR. */
export interface MavenCoordinates {
  /** Group ID (e.g., "com.example"). */
  readonly groupId: string;
  /** Artifact ID (e.g., "order-service"). */
  readonly artifactId: string;
  /** Version (e.g., "1.0.0"). */
  readonly version: string;
  /** Classifier (default: "stubs"). */
  readonly classifier?: string;
}

/** Options for packaging contracts into a stubs JAR. */
export interface PackageOptions {
  /** Directory containing YAML contract files. */
  readonly contractsDir: string;
  /** Maven coordinates for the JAR. */
  readonly coordinates: MavenCoordinates;
  /** Output path for the generated JAR (ZIP) file. */
  readonly outputPath: string;
}

/** Result of a packaging operation. */
export interface PackageResult {
  /** Path to the generated JAR file. */
  readonly outputPath: string;
  /** Number of contracts packaged. */
  readonly contractCount: number;
  /** Number of WireMock mappings generated. */
  readonly mappingCount: number;
  /** Total file size in bytes. */
  readonly sizeBytes: number;
}

/**
 * Package YAML contracts into a Maven stubs JAR (ZIP format).
 *
 * The JAR follows the standard SCC Maven plugin layout:
 * ```
 * META-INF/{groupId}/{artifactId}/{version}/
 *   mappings/*.json       (WireMock mappings)
 *   contracts/*.yaml      (original YAML contracts)
 * ```
 *
 * Java consumers can use this JAR with `@AutoConfigureStubRunner` or
 * the `fetchStubsJar()` / `loadLocalJar()` functions from the jest package.
 */
export async function packageStubsJar(options: PackageOptions): Promise<PackageResult> {
  const contracts = await scanContracts(options.contractsDir);

  if (contracts.length === 0) {
    throw new Error(`No contract files found in ${options.contractsDir}`);
  }

  const { groupId, artifactId, version } = options.coordinates;
  const basePath = `META-INF/${groupId}/${artifactId}/${version}`;

  return new Promise((resolve, reject) => {
    const output = createWriteStream(options.outputPath);
    const archive = archiver("zip", { zlib: { level: 9 } });

    let sizeBytes = 0;

    output.on("close", () => {
      sizeBytes = archive.pointer();
      resolve({
        outputPath: options.outputPath,
        contractCount: contracts.length,
        mappingCount: contracts.length,
        sizeBytes,
      });
    });

    archive.on("error", reject);
    archive.pipe(output);

    // Add original YAML contracts
    for (const contract of contracts) {
      const safeName = sanitizeEntryName(contract.contractName);
      archive.append(contract.content, {
        name: `${basePath}/contracts/${safeName}`,
      });
    }

    // Convert each contract to WireMock JSON and add as mapping
    for (const contract of contracts) {
      const wireMockJson = contractToWireMock(contract);
      const mappingName = toMappingFileName(sanitizeEntryName(contract.contractName));
      archive.append(wireMockJson, {
        name: `${basePath}/mappings/${mappingName}`,
      });
    }

    // Add minimal MANIFEST.MF
    archive.append("Manifest-Version: 1.0\n", {
      name: "META-INF/MANIFEST.MF",
    });

    archive.finalize().catch(reject);
  });
}

/** Strip path traversal sequences and absolute path prefixes from a ZIP entry name. */
function sanitizeEntryName(name: string): string {
  return name
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .split("/")
    .filter((segment) => segment !== ".." && segment !== ".")
    .join("/");
}

/** Convert a contract file name (e.g., "order/get.yaml") to a WireMock mapping name ("order_get.json"). */
function toMappingFileName(contractName: string): string {
  const withoutExt = contractName.slice(0, contractName.length - extname(contractName).length);
  return withoutExt.replace(/[/\\]/g, "_") + ".json";
}
