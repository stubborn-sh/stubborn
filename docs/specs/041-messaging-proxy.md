# Feature 41: AI Messaging Proxy (Firehose Listener)

## What

A passive messaging listener that observes Kafka/RabbitMQ traffic and uses an LLM
to generate Spring Cloud Contract messaging YAML definitions from captured messages.

## Why

Writing messaging contracts manually is tedious. Event-driven architectures often have
dozens of topics with complex payloads. By passively observing real messages and
auto-generating contracts, teams can bootstrap their messaging contract suite from
existing infrastructure with zero production impact.

## How (High Level)

1. Firehose listener joins with a unique consumer group (`stubborn-proxy-{uuid}`)
2. For Kafka: subscribes to configured topics with a dedicated consumer group — never
   competes with real consumers. For RabbitMQ: creates a temporary auto-delete queue
   bound to the exchange — passive observation.
3. Captures N messages per topic (configurable, default 10)
4. Feeds captured messages to the LLM to generate a messaging contract that covers
   the common structure across all captured messages
5. If Schema Registry (Avro/Protobuf/JSON Schema) is configured:
   - Validates the generated contract body against the schema
   - If mismatches exist, feeds validation errors back to the LLM and retries
   - Iterates until the contract body matches the schema (max 3 rounds)
6. Without a schema, LLM infers structure from JSON message payloads
7. Generated messaging contracts are published to the Stubborn broker, flowing into
   the dependency graph, verification pipeline, and can-i-deploy

## Why Messaging Is Different from HTTP

- **Simpler contract shape:** destination + headers + body (no method, URL, status code pairing)
- **No request/response matching:** each message is self-contained
- **Stronger schema guarantees:** Avro schemas give structural correctness that
  OpenAPI validation can only approximate
- **Zero deployment risk:** firehose pattern vs man-in-the-middle proxy

## Business Rules

- Consumer group ID MUST be unique (`stubborn-proxy-{uuid}`) — never compete with
  real consumers
- For RabbitMQ, the temporary queue MUST be auto-delete — cleaned up when listener
  disconnects
- Sensitive headers must be redacted before sending to LLM
- LLM calls have retry with exponential backoff (max 3 attempts)
- Circuit breaker protects against LLM API failures
- Generated contracts use SCC `outputMessage.sentTo` format for the destination
- Application name is derived from topic name or configurable mapping
- When Schema Registry is configured, contracts MUST validate against the schema
  before being published

## Schema Validation Loop

```
Capture N messages
       │
       ▼
  LLM generates contract
       │
       ▼
  Schema Registry configured?
       │
  YES  │  NO
  ▼    │  ▼
Validate against schema   Publish directly
  │
  ▼
Valid?
  │
YES │  NO
▼   │  ▼
Publish  Feed errors to LLM → retry (max 3)
```

## Error Cases

- LLM API unavailable → circuit breaker opens, messages still captured for later processing
- LLM returns invalid YAML → logged as warning, retried once
- Schema validation fails after max retries → contract stored as draft with validation errors
- Kafka/RabbitMQ connection lost → reconnect with backoff, resume capture
- No messages on topic within timeout → skip topic, log info

## Configuration

```yaml
stubborn:
  messaging-proxy:
    enabled: true
    broker-url: http://localhost:8642
    # Kafka configuration
    kafka:
      enabled: true
      bootstrap-servers: localhost:9092
      topics:
        - verifications
        - notifications
        - orders
      messages-per-topic: 10
      consumer-group-prefix: stubborn-proxy
    # RabbitMQ configuration
    rabbit:
      enabled: false
      host: localhost
      port: 5672
      exchanges:
        - name: notifications
          routing-keys:
            - "#"
    # Schema Registry
    schema-registry:
      url: http://localhost:8081
      enabled: false
    # AI configuration
    ai:
      retry-attempts: 3
      timeout: 30s
```

## Module

`stubborn-proxy-messaging/` — separate Spring Boot application alongside the
existing `proxy/` (HTTP) module in `stubborn-commercial/stubborn-pro/`.

## Dependencies

- `spring-kafka` — Kafka consumer
- `spring-amqp` — RabbitMQ consumer
- `spring-ai-starter-model-openai` (optional — swappable for any provider)
- `io.confluent:kafka-avro-serializer` (optional — for Schema Registry)
- `stubborn-api-client` — publish contracts to broker

## Use Case

Brownfield onboarding for event-driven architectures:
1. Point the listener at an existing Kafka cluster
2. Get messaging contracts for all observed topics automatically
3. Contracts flow into the dependency graph
4. Consumer teams can start verifying against the generated contracts
5. Iterate: re-capture to update contracts as message schemas evolve

## Testing

- Unit tests with embedded Kafka (spring-kafka-test)
- Unit tests with mocked ChatClient
- Integration tests with Testcontainers Kafka/RabbitMQ
- Property-based tests for contract generation (jqwik)
- E2E test: firehose listener + real broker instance

## Priority

| Component | Priority | Complexity |
|-----------|----------|------------|
| Kafka firehose listener | HIGH | Medium |
| Contract generation from messages | HIGH | Medium |
| Schema validation loop | MEDIUM | High |
| RabbitMQ firehose listener | LOW | Medium |
| Schema Registry integration | LOW | High |
