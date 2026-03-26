# Feature 25: Local JAR Support for JS SDK

## What

The JS SDK's `@stubborn-sh/jest` package can now load contracts from local
stubs JAR files (Maven artifacts on disk), in addition to fetching from the broker API
or reading from local directories. This enables JS consumers to test against stubs from
Java producers without needing a running broker instance.

## Why

Teams with existing Java producers already have stubs JARs in `~/.m2/repository/` or
Nexus/Artifactory. Without local JAR support, JS consumers must either:
- Run a broker instance and publish contracts first
- Manually extract WireMock JSON from the JAR and point to the directory
- Copy contract files from the Java project

Local JAR support provides a zero-infrastructure path to JS consumer testing.

## How (High Level)

Two changes to the `@stubborn-sh/jest` package:

1. **`loadLocalJar(jarPath)`**: Extracts a local JAR file to a temp directory,
   parses all contracts/mappings, and cleans up.

2. **Nested directory discovery**: A breadth-first search (`findNamedDir`) locates
   `mappings/`, `contracts/`, and `__files/` directories at any nesting depth.
   The SCC Maven plugin puts these under `META-INF/{groupId}/{artifactId}/{version}/`,
   not at the JAR root.

## Acceptance Criteria

- **Given** a stubs JAR at `~/.m2/repository/com/example/order-service/1.0.0/order-service-1.0.0-stubs.jar`
  **When** a JS consumer calls `setupStubs({ jarPath: "/path/to/stubs.jar" })`
  **Then** the stub server starts and responds correctly to matching HTTP requests

- **Given** a stubs JAR with `META-INF/com.example/order-service/1.0.0/mappings/*.json`
  **When** `loadLocalJar()` extracts and searches the JAR
  **Then** mappings are found via BFS regardless of nesting depth

- **Given** a stubs JAR with both root-level `mappings/` and nested `META-INF/.../mappings/`
  **When** `loadLocalJar()` processes the JAR
  **Then** root-level mappings are preferred (BFS finds them first)

- **Given** a JAR with no `mappings/` directory but a `contracts/` directory with YAML files
  **When** `loadLocalJar()` processes the JAR
  **Then** YAML contracts are parsed as the fallback source

- **Given** a non-existent JAR path
  **When** `loadLocalJar()` is called
  **Then** a descriptive error is thrown: "Local stubs JAR not found: /path"

## Error Cases

- JAR file does not exist → `Error("Local stubs JAR not found: ...")`
- Neither `jar` nor `unzip` on PATH → `Error("Cannot extract stubs JAR: ...")`
- JAR contains no contracts or mappings → empty array (no error)
- Corrupted JAR → extraction tool error propagated

## Security

- `extractJar` uses `execFile` (not `exec`) to prevent command injection via jar paths
- `findNamedDir` has a depth limit (10 levels) to prevent resource exhaustion
- Symbolic links are skipped during BFS to prevent traversal attacks

## Sample

See `samples/jar-consumer/` for a working example:
```bash
cd samples/maven-producer && ../../mvnw install -DskipTests
cd samples/jar-consumer && npm ci && npm test
```
