---
feature: npm-messaging-sdk
status: implemented
tests:
  - js/packages/broker-client/tests/unit/client.test.ts
  - js/packages/cli/tests/unit/topics.test.ts
  - js/packages/messaging/tests/unit/contract-parser.test.ts
  - js/packages/messaging/tests/unit/message-stub.test.ts
  - js/packages/messaging-kafka/tests/unit/kafka-sender.test.ts
  - js/packages/messaging-rabbit/tests/unit/rabbit-sender.test.ts
---

# npm SDK — Messaging Support

## Summary

Extend the Stubborn npm SDK to expose the broker's topic topology API.
Users can query which applications publish to which topics via the
`@stubborn-sh/broker-client` and the `stubborn topics` CLI command.

## Motivation

Phase 1 added topic topology to the broker (topic detection at publish time,
`GET /api/v1/topics` endpoints, messaging edges in the dependency graph).
The npm SDK must surface this data so JavaScript/TypeScript users can:

1. Query topic topology programmatically via `BrokerClient`
2. Inspect topics from the command line via `stubborn topics`
3. See messaging edges in the dependency graph response

## Acceptance Criteria

### AC-1: Topic topology types in `@stubborn-sh/broker-client`

- `TopicParticipant` type with `applicationName`, `version`, `topicName`
- `TopicNode` type with `topicName` and `publishers` list
- `TopicTopologyResponse` type with `topics` list
- `MessagingEdge` type with `applicationName`, `topicName`, `version`
- `DependencyGraphResponse` updated to include `messagingEdges`
- `ContractResponse` updated to include `interactionType`

### AC-2: Topic API methods in `BrokerClient`

- `getTopics()` → calls `GET /api/v1/topics`
- `getTopicByName(topicName)` → calls `GET /api/v1/topics/{topicName}`
- `getTopicsForApplication(appName)` → calls `GET /api/v1/topics/applications/{appName}`

### AC-3: CLI `topics` command

- `stubborn topics list` → shows all topics with publishers
- `stubborn topics show <topicName>` → shows single topic detail
- `stubborn topics app <appName>` → shows topics for an application

### AC-4: Graph response includes messaging edges

- `DependencyGraphResponse` type has `messagingEdges` field
- CLI `graph show` displays messaging edges when present

### AC-5: `@stubborn-sh/messaging` core package

- `MessageSender` interface — JS equivalent of SCC's `MessageVerifierSender`
- `MessageReceiver` interface — JS equivalent of SCC's `MessageVerifierReceiver`
- `ReceivedMessage` type with destination, payload, headers
- `MessagingContract` type parsed from YAML contracts
- `isMessagingContract(yaml)` — detects messaging vs HTTP contracts
- `parseMessagingContract(name, yaml)` — parses `outputMessage.sentTo` / `input.messageFrom`
- `MessageStub` — in-memory sender/receiver for unit tests

### AC-6: `@stubborn-sh/messaging-kafka` package

- `KafkaSender` — `MessageSender` impl using kafkajs Producer
- `KafkaReceiver` — `MessageReceiver` impl using kafkajs Consumer
- `startKafkaContainer()` — Testcontainers KafkaContainer setup
- `setupKafkaStubs(config)` / `teardownKafkaStubs()` — drop-in test setup
- `KafkaStubContext.trigger(label)` — triggers a contract by label

### AC-7: `@stubborn-sh/messaging-rabbit` package

- `RabbitSender` — `MessageSender` impl using amqplib
- `RabbitReceiver` — `MessageReceiver` impl using amqplib
- `startRabbitContainer()` — Testcontainers RabbitMQContainer setup
- `setupRabbitStubs(config)` / `teardownRabbitStubs()` — drop-in test setup
- `RabbitStubContext.trigger(label)` — triggers a contract by label

### AC-8: JS Kafka samples

- `samples/js-kafka-producer/` — Node.js service publishing to Kafka
- `samples/js-kafka-consumer/` — Node.js service consuming from Kafka
- Messaging contracts in YAML format matching Java samples
- Contract publishing via `@stubborn-sh/publisher`

## Dependencies

- Phase 1: Broker topic topology API (complete)
- Phase 3: Java auto-configuration modules (complete)
