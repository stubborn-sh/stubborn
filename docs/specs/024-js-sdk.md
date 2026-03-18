# Feature 24: TypeScript/Node.js SDK

## What

A TypeScript/Node.js SDK (`@spring-cloud-contract/*`) that enables JavaScript and TypeScript
applications to participate in the Spring Cloud Contract ecosystem. The SDK provides packages
for publishing contracts, verifying providers, serving stubs, and interacting with the broker
API — all from Node.js without requiring Java tooling.

## Why

Without a JS SDK, JavaScript/TypeScript teams must:
- Manually construct HTTP calls to the broker REST API
- Write custom YAML parsing for contract files
- Build ad-hoc stub servers for consumer testing
- Lack integration with test frameworks (Jest/Vitest)

The SDK provides:
- First-class TypeScript types for all broker API resources
- Contract publishing from YAML/Groovy/JSON files in any directory
- Provider verification with automatic response validation and matcher support
- Stub server that serves contract responses for consumer integration tests
- Jest/Vitest integration helpers (`setupStubs`, `teardownStubs`, `withStubs`)
- CLI for terminal-based broker interaction (`scc-broker` commands)

## How (High Level)

The SDK is a TypeScript monorepo (`js/`) built via npm workspaces.
Each package has a focused responsibility, composed together for end-to-end workflows.

```
JS Producer:  YAML contracts → publisher → broker REST API → contracts stored
JS Consumer:  broker REST API → jest helper → stub-server → HTTP stubs for tests
JS Verifier:  contracts (local or broker) → verifier → HTTP requests → validation
```

## Packages

| Package | Purpose |
|---------|---------|
| `@spring-cloud-contract/broker-client` | HTTP REST client for all broker API endpoints |
| `@spring-cloud-contract/publisher` | Scans directories and publishes contracts to broker |
| `@spring-cloud-contract/verifier` | Verifies provider responses against contracts |
| `@spring-cloud-contract/stub-server` | Native Node.js HTTP server serving contract responses |
| `@spring-cloud-contract/jest` | Jest/Vitest integration (setupStubs, teardownStubs, withStubs, loadLocalJar) |
| `@spring-cloud-contract/cli` | Commander.js CLI wrapping broker-client + publisher |
| `@spring-cloud-contract/stubs-packager` | Package YAML contracts into Maven stubs JARs + deploy to Nexus |

## Contract Format

The SDK supports YAML, JSON, Groovy, Kotlin, and Java contract files.
YAML is the primary format for cross-language use:

```yaml
request:
  method: GET
  urlPath: /api/products/1
response:
  status: 200
  headers:
    Content-Type: application/json
  body:
    id: "1"
    name: "MacBook Pro"
    price: 2499.99
  matchers:
    body:
      - path: $.id
        type: by_regex
        value: "[0-9]+"
```

## Business Rules

- Contracts are published per application name + version
- Content type is auto-detected from file extension
- Stub server matches requests by method, URL path, headers, and body
- Verification compares actual HTTP responses against contract expectations
- Three matcher types: `by_regex`, `by_type`, `by_equality`
- Authentication via HTTP Basic or Bearer token

## Cross-Language Verification

The SDK enables cross-language contract testing:

| Scenario | Producer | Consumer | What's Proven |
|----------|----------|----------|---------------|
| JS → Java (broker) | JS publishes contracts to broker | Java consumes via StubRunner | Java can use JS-published stubs |
| Java → JS (broker) | Java publishes contracts to broker | JS consumes via `setupStubs()` | JS can use Java-published stubs |
| Java → JS (local JAR) | Java installs stubs JAR to `~/.m2` | JS loads via `setupStubs({ jarPath })` | JS can use local Maven stubs without broker |
| JS → Java (Nexus) | JS packages + deploys stubs JAR | Java consumes via StubRunner + Nexus | Java can use JS stubs from Maven repos |

## Acceptance Criteria

- **Given** a JS producer with YAML contracts
  **When** the producer publishes contracts to the broker
  **Then** the contracts appear in the broker API under the application name and version

- **Given** contracts published by a Java producer
  **When** a JS consumer fetches stubs via `setupStubs()`
  **Then** a local stub server responds correctly to HTTP requests matching the contracts

- **Given** a JS producer running a Product API server
  **When** the verifier runs contracts against the server
  **Then** all contract validations pass and results are reported to the broker

- **Given** a JS consumer using stub-server
  **When** requests match published contracts
  **Then** the stub server returns the expected response with correct status, headers, and body

## Error Cases

- Publishing to a non-existent application returns 404 (auto-register or fail)
- Invalid contract YAML fails parsing with descriptive error message
- Stub server returns 404 for requests not matching any contract
- Verification failures include field-level details (expected vs actual)
- Network errors to broker wrapped in `BrokerConnectionError`
- Authentication failures wrapped in `BrokerAuthError` (401) or `BrokerForbiddenError` (403)
