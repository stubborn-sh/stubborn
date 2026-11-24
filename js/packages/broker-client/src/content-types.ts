/**
 * Content types under which a YAML contract can be stored in the broker, all describing the same
 * format: the Java publisher's `application/x-spring-cloud-contract+yaml`, the Stubborn alias
 * `application/x-stubborn+yaml` (both recognised by the broker's `ContractContentTypes`), and
 * `application/x-yaml` / `application/yaml` used by the JS publisher and the broker's importers.
 */
const YAML_CONTENT_TYPES = new Set([
  "application/x-spring-cloud-contract+yaml",
  "application/x-stubborn+yaml",
  "application/x-yaml",
  "application/yaml",
]);

/** Whether a broker contract holds a YAML contract (case-insensitive; parameters ignored). */
export function isYamlContract(contract: { readonly contentType: string }): boolean {
  const mediaType = contract.contentType.split(";")[0]?.trim().toLowerCase() ?? "";
  return YAML_CONTENT_TYPES.has(mediaType);
}
