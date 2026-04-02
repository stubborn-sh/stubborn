---
feature: messaging-topic-topology
status: planned
tests: []
---

# Messaging Contract Support — Topic Topology

## Problem

Stubborn currently treats all contracts as opaque text blobs with no semantic understanding of the contract type. This means:

1. **No distinction between HTTP and messaging contracts** — The broker cannot tell whether a contract describes an HTTP request/response or an async message exchange.
2. **No topic topology** — There is no way to answer "which application publishes to topic X?" or "which topics does application Y subscribe to?"
3. **Dependency graph is incomplete** — The dependency graph only shows provider/consumer edges derived from verification records. Messaging relationships (app → topic → app) are invisible.

Spring Cloud Contract supports messaging contracts in YAML format:

```yaml
label: accepted_verification
input:
    triggeredBy: clientIsOldEnough()
outputMessage:
    sentTo: verifications
    body:
      eligible: true
    headers:
        contentType: application/json
```

Key field: `outputMessage.sentTo` indicates the messaging destination (topic/queue).

The contract is always defined by the **producer** (the app that sends the message). On the consumer side, `StubTrigger.trigger("label")` replays the contract's `outputMessage` body to the destination so the consumer's listener can be tested.

## Solution

### Contract Content Analysis

When a contract is published, the broker analyzes its content using Spring Cloud Contract's native `YamlContractConverter` to detect the interaction type and extract topic references.

- `YamlContractConverter.INSTANCE.convertFrom(file)` parses the contract content into SCC `Contract` objects
- If `contract.getOutputMessage()` is present with `sentTo` → interaction type is `MESSAGING`, topic extracted from `sentTo`
- If neither `outputMessage` nor `input` is present but has `request`/`response` → interaction type is `HTTP`
- Parse failures are handled gracefully (log warning, default to `HTTP`)

The topic direction (PUBLISH vs SUBSCRIBE) is determined by the **verification relationship**, not the contract itself. The app that publishes the contract is the producer (PUBLISH). Apps that verify against it as consumers (via verification records) are subscribers.

### Topic Persistence

A new `contract_topics` table stores the extracted topic references as a denormalized index:

- `contract_id` — FK to the contract
- `application_id` — FK to the application
- `version` — contract version
- `topic_name` — the destination/source name
- The publishing app is the producer; consumers are identified via verification records

The `contracts` table gains an `interaction_type` column (`HTTP` or `MESSAGING`, default `HTTP`).

### Topic Topology API

New REST endpoints expose the messaging topology:

- `GET /api/v1/topics` — all topics with their publishers and subscribers
- `GET /api/v1/topics/{topicName}` — publishers/subscribers for a specific topic
- `GET /api/v1/topics/applications/{appName}` — topics an application interacts with

### Graph Enhancement

The dependency graph includes messaging edges alongside verification-based edges:

- Topic nodes appear as a distinct node type in the graph
- Edges connect applications to topics with direction (PUBLISH/SUBSCRIBE)
- UI renders topic nodes with a different shape and messaging edges with dashed lines

## Acceptance Criteria

- [ ] **AC-1**: Publishing a contract with `outputMessage.sentTo: verifications` results in `interactionType = MESSAGING` on the contract and a `contract_topics` record with `topic_name = verifications`.
- [ ] **AC-2**: Publishing a standard HTTP contract (with `request`/`response`) results in `interactionType = HTTP` and no `contract_topics` records.
- [ ] **AC-4**: Publishing a contract with unparseable content defaults to `interactionType = HTTP` with a warning log (no error).
- [ ] **AC-5**: `GET /api/v1/topics` returns all known topics with their publishers and subscribers grouped by topic name.
- [ ] **AC-6**: `GET /api/v1/topics/{topicName}` returns 404 for unknown topics.
- [ ] **AC-7**: `GET /api/v1/topics/applications/{appName}` returns all topics the application publishes to or subscribes from.
- [ ] **AC-8**: The dependency graph response includes `messagingEdges` alongside existing verification edges.
- [ ] **AC-9**: `ContractResponse` and `ContractInfo` include the `interactionType` field.
- [ ] **AC-10**: Existing HTTP contracts are unaffected (default `interactionType = HTTP`).
