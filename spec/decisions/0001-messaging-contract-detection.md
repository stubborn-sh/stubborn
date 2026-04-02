# ADR 0001 — Messaging Contract Detection via SCC YamlContractConverter

## Status

Accepted

## Context

Stubborn needs to distinguish HTTP contracts from messaging contracts to build a topic topology (which app publishes/subscribes to which topic). The question is how to detect the contract type.

**Options considered:**

1. **Publisher metadata** — Add an `interactionType` field to `CreateContractRequest` and require publishers to declare the type.
2. **Raw YAML parsing** — Use Jackson's YAML ObjectMapper to parse the contract content as a JSON tree and check for messaging-specific fields.
3. **SCC native parsing** — Use Spring Cloud Contract's `YamlContractConverter` to parse the contract into SCC `Contract` objects and inspect the domain model.

## Decision

**Option 3: SCC native parsing with `YamlContractConverter`.**

## Rationale

- **Already proven** — `BrokerStubDownloader` already uses `YamlContractConverter.INSTANCE.convertFrom(file)` to parse contracts (line 147). The same approach works on the broker side.
- **Format-agnostic** — SCC's converter handles YAML, JSON, and Groovy contract formats natively. Raw YAML parsing would miss Groovy contracts entirely.
- **Domain-aware** — The resulting `Contract` objects expose `getInput()`, `getOutputMessage()`, `getRequest()`, `getResponse()` — exactly the fields needed to classify interaction type and extract topics.
- **No client changes** — Unlike option 1, this requires no changes to `CreateContractRequest`, the Maven plugin, the Gradle plugin, the JS publisher, or the CLI.
- **Forward-compatible** — As SCC adds new contract features, the parser automatically supports them.

**Trade-off:** The broker gains a compile-time dependency on `spring-cloud-contract-verifier` (specifically the converter). This is acceptable because:
- The `broker-stub-downloader` module already depends on it
- The broker can use it as a `provided` or `optional` dependency if needed
- The converter is stateless and lightweight

## Consequences

- `ContractContentAnalyzer` writes contract content to a temp file and calls `YamlContractConverter.INSTANCE.convertFrom(file)`
- The broker's `pom.xml` adds `spring-cloud-contract-verifier` as a dependency (or the analyzer lives in a shared module)
- Contract analysis happens synchronously during `ContractService.publish()` — the overhead is negligible for small contract files
- Malformed contracts that SCC cannot parse are gracefully handled (default to HTTP, log warning)
