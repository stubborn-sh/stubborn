# Feature 26: Stubs Packager (TS Producer → Nexus/Artifactory)

## What

A new `@stubborn-sh/stubs-packager` npm package that lets TypeScript/Node.js
producers package their YAML contracts into Maven stubs JARs (ZIP format) and deploy
them to Nexus/Artifactory repositories. This enables Java consumers to use
`@AutoConfigureStubRunner` against JS-produced stubs without needing the broker.

## Why

Without this package, JS producers can only publish contracts to the broker REST API.
Java consumers that use `@AutoConfigureStubRunner` with Maven repository mode
(`stubsMode = CLASSPATH` or `REMOTE`) cannot consume these contracts because no
stubs JAR exists in the Maven repository.

The stubs-packager closes this gap by enabling JS producers to create stubs JARs
that are byte-compatible with those produced by the SCC Maven/Gradle plugin.

## How (High Level)

Three components:

1. **`contractToWireMock(contract)`**: Converts a YAML contract to WireMock JSON mapping
   string. This is the reverse of `parseWireMockMapping` from the stub-server package.

2. **`packageStubsJar(options)`**: Scans a contracts directory, converts each contract to
   WireMock JSON, and creates a ZIP file with the standard SCC Maven plugin layout:
   ```
   META-INF/{groupId}/{artifactId}/{version}/
     mappings/*.json       (WireMock mappings)
     contracts/*.yaml      (original YAML contracts)
   ```

3. **`deployStubsJar(options)`**: Uploads the packaged JAR to a Maven repository via
   HTTP PUT with Basic Auth or Bearer token support.

## Acceptance Criteria

- **Given** YAML contracts in a directory
  **When** `packageStubsJar()` is called with Maven coordinates
  **Then** a ZIP file is created with the correct SCC layout (contracts + WireMock mappings)

- **Given** a packaged stubs JAR
  **When** extracted by Java's `@AutoConfigureStubRunner`
  **Then** WireMock mappings are found and used correctly (Java interop)

- **Given** a packaged stubs JAR and Maven repository credentials
  **When** `deployStubsJar()` is called
  **Then** the JAR is uploaded via HTTP PUT to the correct Maven path

- **Given** a YAML contract with request method, URL, headers, body, and response
  **When** `contractToWireMock()` converts it
  **Then** the output matches what Java SCC Verifier would produce

- **Given** an empty contracts directory
  **When** `packageStubsJar()` is called
  **Then** an error is thrown: "No contract files found"

## Error Cases

- Empty contracts directory → `Error("No contract files found")`
- Invalid YAML contract → Error with contract name and parse details
- Missing required fields (method, url, response) → Descriptive error
- Deploy to unreachable server → Network error propagated
- Invalid repository URL scheme (not http/https) → `Error("Invalid repository URL scheme")`
- JAR file not found for deploy → `Error("JAR file not found")`

## Security

- ZIP entry names are sanitized to prevent zip-slip attacks (`../` stripped)
- Repository URL scheme validated (http/https only)
- YAML parsed with `JSON_SCHEMA` to prevent `!!js/` type-tag attacks
- Auth credentials use `Buffer.from().toString("base64")` for non-ASCII safety
- Deploy uses `AbortSignal.timeout(30_000)` to prevent hanging connections
