# Learning: JavaScript/TypeScript SDK

**Category:** Architecture
**Last Updated:** 2026-03-13

## Related Files

- `js/packages/broker-client/src/client.ts` — BrokerClient REST API wrapper
- `js/packages/publisher/src/publisher.ts` — ContractPublisher
- `js/packages/verifier/src/verifier.ts` — ContractVerifier
- `js/packages/stub-server/src/stub-server.ts` — StubServer
- `js/packages/jest/src/setup-stubs.ts` — Test framework integration (5 stubs sources)
- `js/packages/jest/src/jar-fetcher.ts` — Local JAR loading + nested dir discovery
- `js/packages/stubs-packager/src/` — YAML→WireMock converter, JAR packager, deployer
- `js/packages/cli/src/index.ts` — CLI entry point
- `samples/js-producer/` — JS producer sample (cross-language, broker)
- `samples/js-consumer/` — JS consumer sample (cross-language, broker)
- `samples/jar-consumer/` — JS consumer sample (local JAR, no broker)

## Findings

### 1. Package Architecture (discovered 2026-03-13)

The JS SDK uses npm workspaces with multiple packages, each with a focused responsibility:
- `broker-client` has zero dependencies (pure TypeScript HTTP client)
- `publisher` depends on `broker-client` + file scanner
- `verifier` depends on `broker-client` + `stub-server` (for contract parsing)
- `stub-server` depends only on `js-yaml` for YAML parsing
- `jest` composes `broker-client` + `stub-server` for test framework integration
- `cli` composes `broker-client` + `publisher` + `chalk` + `commander`

**Evidence:** Package.json dependency graph in `js/packages/*/package.json`

### 2. Contract Format Compatibility (discovered 2026-03-13)

YAML contracts work across Java and JS boundaries:
- Java SCC generates WireMock JSON from YAML contracts
- JS SDK parses YAML directly for stub-server and verifier
- The YAML format is the lingua franca for cross-language testing
- Content type `application/x-yaml` is used in the broker API

**Evidence:** `shouldReturnOrder.yaml` used by both maven-producer and js-consumer

### 3. Stub Server vs WireMock (discovered 2026-03-13)

The JS stub server is a native Node.js HTTP server (not WireMock):
- Simpler deployment (no JVM dependency)
- Parses YAML contracts directly
- Supports body matchers (regex, type, equality) via JSONPath
- Max request body size: 1 MB
- For Java consumers, WireMock stubs are still used via `@AutoConfigureStubRunner`

### 4. Cross-Language Samples Architecture (discovered 2026-03-13)

Two cross-language sample pairs demonstrate interoperability:
- **Pair 4:** JS producer (product-service) → Java consumer (maven-consumer via StubRunner)
- **Pair 5:** Java producer (maven-producer/order-service) → JS consumer (stub-server)

The Product Service domain (products: id, name, price, inStock) is used by the JS producer
to avoid conflicts with the Order Service domain used by existing maven-producer.

### 5. Build Integration (discovered 2026-03-13)

JS samples integrate with Maven via `exec-maven-plugin`:
- `npm install` + `npm run test:integration` during `integration-test` phase
- JS packages referenced via `file:` protocol from workspace
- Docker Compose lifecycle managed by parent `samples/pom.xml`

### 6. Local JAR Support (discovered 2026-03-13)

The `@spring-cloud-contract/jest` package supports 5 stubs sources:
1. Broker REST API (`brokerUrl`)
2. Local contracts directory (`contractsDir`)
3. Local WireMock mappings (`mappingsDir`)
4. Remote Maven stubs JAR (`stubsJar` — download + extract)
5. Local Maven stubs JAR (`jarPath` — extract only, no broker needed)

The local JAR support uses `findNamedDir()` — a depth-limited BFS that locates
`mappings/`, `contracts/`, and `__files/` at any nesting level. This handles both
root-level and `META-INF/{groupId}/{artifactId}/{version}/` layouts.

**Evidence:** `jar-fetcher.ts` `loadLocalJar()`, `samples/jar-consumer/`

### 7. Stubs Packager (discovered 2026-03-13)

New `@spring-cloud-contract/stubs-packager` package enables JS producers to:
- Convert YAML contracts to WireMock JSON mappings (`contractToWireMock`)
- Package into Maven stubs JARs with standard SCC layout (`packageStubsJar`)
- Deploy to Nexus/Artifactory via HTTP PUT (`deployStubsJar`)

The packaged JARs are byte-compatible with Java SCC Maven/Gradle plugin output.

**Evidence:** `js/packages/stubs-packager/src/`

## Change Log

| Date | Change |
|------|--------|
| 2026-03-13 | Initial discovery during JS SDK sample implementation |
| 2026-03-13 | Added local JAR support, stubs-packager, broker Maven import |
