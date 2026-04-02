---
feature: npm-messaging-sdk
status: implemented
tests:
  - js/packages/broker-client/tests/unit/client.test.ts
  - js/packages/cli/tests/unit/topics.test.ts
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

## Out of Scope

- `@stubborn-sh/messaging` core abstractions (Phase 2 future)
- `@stubborn-sh/messaging-kafka` / `messaging-rabbit` packages (Phase 2 future)
- Contract content parsing in JS (broker handles this server-side)

## Dependencies

- Phase 1: Broker topic topology API (complete)
