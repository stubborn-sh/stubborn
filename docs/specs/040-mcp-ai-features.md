---
feature: mcp-ai-features
status: planned
tests: []
---

# MCP Server AI Features

## Overview

Extend the MCP server with AI-powered tools that go beyond CRUD operations on the broker.
These tools leverage the broker's contract and verification data to provide intelligent
assistance to AI coding agents.

## Motivation

The current MCP server (spec 010) provides 20 tools for managing applications, contracts,
verifications, deployments, tags, selectors, and cleanup. These are essential building blocks.

The next step is to add **AI-native tools** that combine broker data with reasoning to help
developers write correct code, detect drift, assess impact, and author contracts in natural
language.

## Planned Tools

### 1. generate_contract_from_code

**Category:** Contract Generation

Generate SCC contract YAML from source code (e.g., Spring controller annotations,
request/response types).

**Parameters:**
- `code` (required, String): Source code of the controller or endpoint
- `language` (optional, String): Programming language (default: 'java')
- `format` (optional, String): Output format - 'yaml' or 'groovy' (default: 'yaml')

**Behavior:**
- Parse the code to extract endpoint path, HTTP method, request body structure,
  response body structure, status codes, and validation constraints
- Generate one contract per endpoint method
- Include realistic example values based on field names and types
- Respect @Valid / @NotNull / @Size annotations for request constraints

**Use case:** Brownfield projects with existing endpoints but no contracts.
AI agent reads the controller and generates contracts for all endpoints at once.

---

### 2. generate_contract_from_natural_language

**Category:** Contract Authoring

Convert a natural language description into SCC contract YAML.

**Parameters:**
- `description` (required, String): Natural language description of the API interaction
- `format` (optional, String): Output format - 'yaml' or 'groovy' (default: 'yaml')
- `providerName` (optional, String): Provider application name (for metadata)

**Behavior:**
- Parse the description to extract HTTP method, URL, request/response structure
- Generate realistic example values
- Infer status codes from context (e.g., "creates" → 201, "deletes" → 204)
- Handle edge cases described in natural language (e.g., "returns 404 if not found")

**Use case:** Non-Java teams or developers unfamiliar with Groovy DSL can author
contracts by describing them in plain English.

**Example input:**
```
"User sends a POST to /orders with a product ID and quantity.
Server responds with 201 and returns the order ID, status CREATED,
and the total price."
```

---

### 3. detect_contract_drift

**Category:** Drift Detection

Compare captured production traffic patterns against published contracts to detect
divergence.

**Parameters:**
- `applicationName` (required, String): Provider application name
- `version` (required, String): Provider version to check against
- `trafficSummary` (required, String): JSON summary of observed traffic patterns
  (status code distribution, response fields, request patterns)

**Behavior:**
- Fetch published contracts for the given application version
- Compare contract expectations against traffic summary:
  - Status codes: contract says 200 but traffic shows 422 at 15%
  - Response fields: contract expects `orderId` but traffic includes extra `legacyId`
  - Request patterns: traffic sends fields not in the contract
- Return a drift report with severity levels (INFO, WARNING, CRITICAL)
- Suggest contract updates for confirmed drifts

**Use case:** Continuous validation that production behavior matches contract intent.
Catch undocumented API changes before they become incidents.

---

### 4. analyze_consumer_impact

**Category:** Impact Analysis

Before changing a contract, analyze which consumers would be affected and how.

**Parameters:**
- `providerName` (required, String): Provider application name
- `providerVersion` (required, String): Provider version
- `proposedChange` (required, String): Description of the proposed change
  (e.g., "remove field legacyId from /orders response",
   "change status field from string to enum",
   "add required header X-Request-Id")

**Behavior:**
- Fetch the current contract for the provider version
- Fetch all consumers with successful verifications against this provider
- For each consumer, analyze whether the proposed change would break their contract:
  - Field removal: check if any consumer contract references the field
  - Type change: check if consumer expectations match the new type
  - New required field: check if consumers send/expect the field
- Return a structured impact report:
  - List of affected consumers with specific breakage details
  - List of unaffected consumers
  - Risk assessment (LOW / MEDIUM / HIGH / CRITICAL)
  - Suggested migration approach

**Use case:** "I want to remove `legacyId` from the response. Who would break?"
Know the blast radius before touching the contract.

---

### 5. suggest_contract_for_consumer

**Category:** Contract Assistance

Given a consumer's code or description, suggest which provider contracts it should
verify against and generate consumer-side test stubs.

**Parameters:**
- `consumerName` (required, String): Consumer application name
- `providerName` (required, String): Provider to consume from
- `consumerCode` (optional, String): Consumer's HTTP client code
- `description` (optional, String): Natural language description of what the consumer needs

**Behavior:**
- Fetch all published contracts for the provider
- Match consumer needs against available contracts
- Generate consumer-side verification configuration
- Suggest stub runner configuration for the consumer's test suite

**Use case:** New consumer team wants to integrate with an existing provider.
AI reads their client code and wires up contract testing automatically.

---

## AI Messaging Listener (Separate Module)

Not an MCP tool but a companion to the existing HTTP AI proxy — a passive
messaging listener that generates contracts from Kafka/RabbitMQ traffic.

### Concept

- **Firehose pattern:** Joins the cluster with its own unique consumer group
  (`stubborn-proxy-{uuid}`), never competes with real consumers. Read-only,
  zero impact on production.
- **Captures N messages** per topic, feeds them to the LLM to generate a
  messaging contract that covers the common structure.
- **Schema validation loop:** If Schema Registry (Avro/Protobuf/JSON Schema)
  is configured, validates the generated contract against the schema. If
  mismatches exist, feeds errors back to the LLM and retries until the
  contract body matches. Without a schema, LLM infers structure from JSON.
- **RabbitMQ support:** Same concept using a temporary auto-delete queue
  bound to the exchange. Passive observation.
- **Output:** Generated messaging contracts pushed to the Stubborn broker,
  flowing into the dependency graph, verification pipeline, and can-i-deploy.

### Why Messaging Is Different from HTTP

- **Simpler contract shape:** destination + headers + body (no method, URL,
  status code pairing)
- **No request/response matching:** each message is self-contained
- **Stronger schema guarantees:** Avro schemas give structural correctness
  that OpenAPI validation can only approximate
- **Zero deployment risk:** firehose vs man-in-the-middle

### Use Case

Brownfield onboarding for event-driven architectures. Point the listener at
an existing Kafka cluster, get messaging contracts for all topics automatically.

### Module

`stubborn-proxy-messaging/` — separate Spring Boot application alongside
the existing `proxy/` (HTTP) module.

---

## New MCP Prompts

### 6. contract-generation-workflow

**Type:** Guided prompt

Walk an AI agent through generating contracts for an entire service.

**Steps:**
1. Read the service's source code (controllers / routes)
2. For each endpoint, generate a contract using `generate_contract_from_code`
3. Validate generated contracts against OpenAPI spec (if available)
4. Register the application if not already registered
5. Publish all contracts to the broker
6. Suggest consumer verification setup

### 7. drift-analysis-workflow

**Type:** Guided prompt

Walk an AI agent through analyzing contract drift for a service.

**Steps:**
1. Fetch published contracts for the service
2. Capture or summarize recent production traffic
3. Run `detect_contract_drift` for each endpoint
4. Generate a drift report with severity and recommendations
5. Optionally create updated contracts for confirmed drifts

### 8. breaking-change-workflow

**Type:** Guided prompt

Walk an AI agent through safely making a breaking API change.

**Steps:**
1. Describe the proposed change
2. Run `analyze_consumer_impact` to assess blast radius
3. For each affected consumer, suggest migration path
4. Generate updated contracts (old version deprecated, new version published)
5. Run `can_i_deploy` to verify safety after consumer updates

---

## Implementation Notes

- Tools 1-2 (contract generation) require an LLM call — the MCP server should use
  Spring AI's ChatClient to delegate to the configured model
- Tool 3 (drift detection) can be implemented with pattern matching initially,
  with AI enhancement for fuzzy field matching
- Tool 4 (impact analysis) combines broker data queries with structural comparison —
  mostly deterministic, AI adds natural language explanation
- Tool 5 (consumer suggestion) is a combination of broker queries and code analysis
- All new tools should follow existing patterns: BrokerClient for data access,
  @Tool annotation, proper error handling, HTTP Basic auth
- New prompts follow existing BrokerPrompts.java pattern

## Security

- All new tools require at minimum READER role
- Tools that generate/publish contracts require ADMIN role
- LLM calls must not leak sensitive contract data outside the configured model endpoint
- Rate limiting recommended for LLM-backed tools

## Testing

- Unit tests with mocked BrokerClient and ChatClient
- Integration tests with WireMock for broker API
- Property-based tests for contract generation (jqwik)
- E2E test with real broker instance

## Priority

| Tool | Priority | Complexity |
|------|----------|------------|
| generate_contract_from_natural_language | HIGH | Medium |
| analyze_consumer_impact | HIGH | Medium |
| generate_contract_from_code | MEDIUM | High |
| detect_contract_drift | MEDIUM | High |
| suggest_contract_for_consumer | LOW | Medium |
