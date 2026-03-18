const EXTENSION_MAP: ReadonlyMap<string, string> = new Map([
  [".yaml", "application/x-yaml"],
  [".yml", "application/x-yaml"],
  [".json", "application/json"],
  [".groovy", "application/x-groovy"],
  [".kts", "application/x-kotlin"],
  [".kt", "application/x-kotlin"],
  [".java", "text/x-java-source"],
]);

/**
 * Detect the content type of a contract file based on its extension.
 * Returns null for unknown extensions.
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
