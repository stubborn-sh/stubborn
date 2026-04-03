---
feature: messaging-samples
status: in-progress
tests:
  - org.example.verification.VerificationTest
  - org.example.notification.NotificationTest
  - org.example.verification.VerificationListenerIT
  - org.example.notification.NotificationListenerIT
---

# Messaging Contract Samples

## Overview

Sample applications demonstrating messaging contract testing with Kafka and RabbitMQ
using the `stubborn-messaging-kafka` and `stubborn-messaging-rabbit` auto-configuration
modules.

## Kafka Samples

### kafka-producer (Verification Service)

A Spring Boot service that publishes `VerificationResult` messages to a `verifications`
Kafka topic via `KafkaTemplate`.

**Contract:** `shouldSendAcceptedVerification.yaml`
- Defines an `outputMessage` sent to `verifications` topic
- Body contains verification result with id, status, and reason
- `triggeredBy: triggerVerification()` in the base test class

**Testing:**
- SCC generates a test from the messaging contract
- Base class (`VerificationContractBase`) triggers message sending
- `stubborn-messaging-kafka` auto-configures `MessageVerifierSender` and `MessageVerifierReceiver`
- Testcontainers Kafka via `@ServiceConnection` in test `@Configuration`

### kafka-consumer (Verification Processor)

A Spring Boot service with a `@KafkaListener` that processes verification messages
from the `verifications` topic.

**Testing:**
- Uses `@AutoConfigureStubRunner` with `sccbroker://` protocol
- `stubborn-messaging-kafka` auto-configures messaging verifier beans
- StubRunner sends the contract-defined message to Kafka
- Test verifies the listener processed the message correctly
- Requires broker + Docker Compose (integration test, runs in CI)

## RabbitMQ Samples

### rabbit-producer (Notification Service)

A Spring Boot service that publishes `NotificationEvent` messages to a `notifications`
RabbitMQ queue via `RabbitTemplate`.

**Contract:** `shouldSendOrderConfirmation.yaml`
- Defines an `outputMessage` sent to `notifications` queue
- Body contains notification event with type, recipient, and message

### rabbit-consumer (Notification Processor)

A Spring Boot service with a `@RabbitListener` that processes notification messages
from the `notifications` queue.

**Testing:** Same pattern as kafka-consumer but with RabbitMQ.

## User Experience

### Producer side (1 dependency + base class)

```xml
<dependency>
    <groupId>sh.stubborn</groupId>
    <artifactId>stubborn-messaging-kafka</artifactId>
    <scope>test</scope>
</dependency>
```

### Consumer side (1 dependency + annotation)

```xml
<dependency>
    <groupId>sh.stubborn</groupId>
    <artifactId>stubborn-messaging-kafka</artifactId>
    <scope>test</scope>
</dependency>
```

```java
@AutoConfigureStubRunner(ids = "...", repositoryRoot = "sccbroker://...")
```

## Acceptance Criteria

- [x] kafka-producer compiles and contract tests pass
- [ ] kafka-consumer compiles and stub runner tests pass (requires broker in CI)
- [x] rabbit-producer compiles and contract tests pass
- [ ] rabbit-consumer compiles and stub runner tests pass (requires broker in CI)
- [ ] Contracts published to broker successfully (requires Docker Compose)
- [ ] Consumer tests fetch stubs from broker and verify (requires Docker Compose)

## Not Yet Implemented

- JS Kafka samples (`js-kafka-producer/`, `js-kafka-consumer/`) — plan step 4.3
- E2E verification: full flow through broker — plan step 4.4
