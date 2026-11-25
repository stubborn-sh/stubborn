import { createWriteStream } from "node:fs";
import { join, posix } from "node:path";
import archiver from "archiver";
import { scanContracts } from "@stubborn-sh/publisher";
import { contractFileReader } from "@stubborn-sh/stub-server";
import { convertContract } from "./contract-to-wiremock.js";

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
  /** Number of contract files packaged. */
  readonly contractCount: number;
  /**
   * Number of WireMock mappings generated: one per HTTP contract of the YAML files (a file can
   * hold several), none for messaging or ignored contracts.
   */
  readonly mappingCount: number;
  /** The contracts no mapping was generated for, and why. */
  readonly skipped: readonly string[];
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
 *   contracts/*.yaml      (original YAML contracts, and the files they reference)
 * ```
 *
 * Each YAML file gives the WireMock mappings the JVM plugins generate for it (see
 * `convertContract`): one per HTTP contract, named `<directory>_<contract name>.json` (the
 * directory's `/` written `_`), with referenced files (`bodyFromFile`…) read relative to the
 * contract and inlined. Messaging and ignored contracts get no mapping; other contract files
 * (Groovy, JSON) are packaged without one. A contract the JVM would reject fails packaging.
 *
 * Java consumers can use this JAR with `@AutoConfigureStubRunner` or
 * the `fetchStubsJar()` / `loadLocalJar()` functions from the jest package.
 */
export async function packageStubsJar(options: PackageOptions): Promise<PackageResult> {
  const contracts = await scanContracts(options.contractsDir);

  if (contracts.length === 0) {
    throw new Error(`No contract files found in ${options.contractsDir}`);
  }

  // Convert first, so that a contract the JVM would reject fails packaging before any output.
  // Only YAML contracts are converted: the others are packaged as they are.
  const conversions = contracts
    .filter((contract) => isYaml(contract.contractName))
    .map((contract) => ({
      contract,
      ...convertContract(contract, {
        readFile: contractFileReader(join(options.contractsDir, contract.contractName)),
      }),
    }));
  const mappingCount = conversions.reduce((n, c) => n + c.stubs.length, 0);
  const skipped = [
    ...conversions.flatMap((c) => c.skipped),
    ...contracts
      .filter((contract) => !isYaml(contract.contractName))
      .map((contract) => `${contract.contractName}: not a YAML contract`),
  ];

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
        mappingCount,
        skipped,
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

    // The files the YAML contracts reference, next to them as in the contracts directory.
    for (const { contract, files } of conversions) {
      for (const [path, content] of files) {
        const entry = posix.normalize(posix.join(posix.dirname(contract.contractName), path));
        if (entry.startsWith("../") || posix.isAbsolute(entry)) continue; // outside the directory
        archive.append(Buffer.from(content), {
          name: `${basePath}/contracts/${sanitizeEntryName(entry)}`,
        });
      }
    }

    // The WireMock mappings the JVM generates for the contracts.
    for (const { contract, stubs } of conversions) {
      const directory = posix.dirname(sanitizeEntryName(contract.contractName));
      const prefix = directory === "." ? "" : `${directory.replace(/\//g, "_")}_`;
      for (const stub of stubs) {
        archive.append(stub.json, {
          name: `${basePath}/mappings/${prefix}${stub.fileName}`,
        });
      }
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

function isYaml(contractName: string): boolean {
  return /\.ya?ml$/i.test(contractName);
}
