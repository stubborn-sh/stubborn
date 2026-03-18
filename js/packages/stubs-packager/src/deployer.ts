import { readFile, stat } from "node:fs/promises";

/** Configuration for deploying a stubs JAR to a Maven repository. */
export interface DeployOptions {
  /** Path to the local stubs JAR file. */
  readonly jarPath: string;
  /** Maven repository URL (e.g., "https://nexus.example.com/repository/releases"). */
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

/** Result of a deploy operation. */
export interface DeployResult {
  /** The full URL where the JAR was uploaded. */
  readonly url: string;
  /** HTTP status code from the upload. */
  readonly statusCode: number;
}

/**
 * Deploy a stubs JAR to a Maven repository via HTTP PUT.
 *
 * Supports Basic Auth and Bearer token authentication.
 * The JAR is uploaded to the standard Maven path:
 * `{repoUrl}/{groupPath}/{artifactId}/{version}/{artifactId}-{version}-{classifier}.jar`
 */
export async function deployStubsJar(options: DeployOptions): Promise<DeployResult> {
  const url = buildDeployUrl(options);

  await stat(options.jarPath).catch(() => {
    throw new Error(`JAR file not found: ${options.jarPath}`);
  });

  const jarContent = await readFile(options.jarPath);

  const headers: Record<string, string> = {
    "Content-Type": "application/java-archive",
  };

  if (options.token !== undefined) {
    headers["Authorization"] = `Bearer ${options.token}`;
  } else if (options.username !== undefined && options.password !== undefined) {
    headers["Authorization"] =
      `Basic ${Buffer.from(`${options.username}:${options.password}`).toString("base64")}`;
  }

  const response = await fetch(url, {
    method: "PUT",
    headers,
    body: jarContent,
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `Failed to deploy stubs JAR to ${url}: ${response.status} ${response.statusText}${body ? ` — ${body}` : ""}`,
    );
  }

  return { url, statusCode: response.status };
}

/** Build the Maven repository URL for a stubs JAR. */
function buildDeployUrl(options: DeployOptions): string {
  const classifier = options.classifier ?? "stubs";
  const groupPath = options.groupId.replace(/\./g, "/");
  const baseUrl = options.repositoryUrl.replace(/\/+$/, "");

  // Validate URL scheme
  const parsed = new URL(baseUrl);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`Invalid repository URL scheme: ${parsed.protocol} (only http/https allowed)`);
  }

  return `${baseUrl}/${groupPath}/${options.artifactId}/${options.version}/${options.artifactId}-${options.version}-${classifier}.jar`;
}
