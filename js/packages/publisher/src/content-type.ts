/**
 * Content types the contracts are published under, as the JVM publisher
 * (`ContractContentType` in broker-contract-publisher) sends them. The broker recognises the YAML
 * one as a YAML contract (`ContractContentTypes`); it stores the others as given.
 */
const YAML = "application/x-spring-cloud-contract+yaml";
const GROOVY = "application/x-spring-cloud-contract+groovy";
const JSON_TYPE = "application/json";

const EXTENSION_MAP: ReadonlyMap<string, string> = new Map([
  [".yaml", YAML],
  [".yml", YAML],
  [".groovy", GROOVY],
  [".json", JSON_TYPE],
]);

/**
 * Detect the content type of a contract file based on its extension (case-insensitive), as the
 * JVM publisher does. Returns null for files the JVM publisher does not publish (including
 * Kotlin and Java DSL contracts, which the broker's stub downloader cannot restore).
 */
export function detectContentType(filename: string): string | null {
  if (filename === "") {
    return null;
  }
  const lastDot = filename.lastIndexOf(".");
  if (lastDot === -1) {
    return null;
  }
  const ext = filename.slice(lastDot).toLowerCase();
  return EXTENSION_MAP.get(ext) ?? null;
}

/** Get all known contract file extensions. */
export function knownExtensions(): readonly string[] {
  return [...EXTENSION_MAP.keys()];
}

/**
 * The name a contract file is published under: its path relative to the contracts directory
 * without the file's extension (`orders/get.yaml` → `orders/get`), as the JVM publisher strips
 * it. The broker's stub downloader adds `.yaml` back when it writes the contract.
 *
 * Unlike the JVM publisher, which publishes the bare file name, the directory is kept so that
 * contracts with the same file name in different directories do not collide.
 */
export function brokerContractName(relativePath: string): string {
  const slash = relativePath.lastIndexOf("/");
  const dot = relativePath.lastIndexOf(".");
  // As the JVM's stripExtension: a leading dot (".yaml") is not an extension.
  return dot > slash + 1 ? relativePath.slice(0, dot) : relativePath;
}
