---
feature: java-messaging-auto-config
status: implemented
tests:
  - sh.stubborn.messaging.kafka.StubbornKafkaAutoConfigurationTest
  - sh.stubborn.messaging.kafka.StubbornKafkaMessageVerifierTest
  - sh.stubborn.messaging.kafka.StubbornKafkaContainerConfigurationTest
  - sh.stubborn.messaging.rabbit.StubbornRabbitAutoConfigurationTest
  - sh.stubborn.messaging.rabbit.StubbornRabbitMessageVerifierTest
  - sh.stubborn.messaging.rabbit.StubbornRabbitContainerConfigurationTest
---

# Java Auto-Configuration Modules for Messaging Contract Tests

## Summary

Provide drop-in Spring Boot auto-configuration modules that eliminate
boilerplate when writing messaging contract tests with Stubborn.
Adding a single dependency (`stubborn-messaging-kafka` or
`stubborn-messaging-rabbit`) should auto-configure:

1. A `MessageVerifierSender` and `MessageVerifierReceiver` bean
2. A Testcontainers-managed broker instance with `@ServiceConnection`
3. Configuration properties for timeouts and container image overrides

## Motivation

In Spring Cloud Contract, messaging contract tests require manual setup:
a custom `MessageVerifierReceiver` bean, Testcontainers configuration,
and `@DynamicPropertySource` wiring. This is ~100 lines of boilerplate
per project. Stubborn should eliminate this.

## Acceptance Criteria

### AC-1: `stubborn-messaging-kafka` auto-configuration

- `StubbornKafkaAutoConfiguration` activates when `KafkaTemplate` is on classpath
- Provides `MessageVerifierSender<Message<?>>` that sends via `KafkaTemplate`
- Provides `MessageVerifierReceiver<Message<?>>` that consumes via `KafkaConsumer`
- Beans are conditional: not created if user defines their own

### AC-2: `stubborn-messaging-kafka` Testcontainers support

- `StubbornKafkaContainerConfiguration` provides a `KafkaContainer` bean
- Container uses `@ServiceConnection` for auto-wired `bootstrap-servers`
- Container image configurable via `stubborn.messaging.kafka.image`
- Configuration is conditional on Testcontainers being on classpath

### AC-3: `stubborn-messaging-kafka` properties

- `stubborn.messaging.kafka.receive-timeout` (default: 10s)
- `stubborn.messaging.kafka.image` (default: `apache/kafka`)

### AC-4: `stubborn-messaging-rabbit` auto-configuration

- `StubbornRabbitAutoConfiguration` activates when `RabbitTemplate` is on classpath
- Provides `MessageVerifierSender<Message<?>>` that sends via `RabbitTemplate`
- Provides `MessageVerifierReceiver<Message<?>>` that consumes via `RabbitTemplate.receive()`
- Beans are conditional: not created if user defines their own

### AC-5: `stubborn-messaging-rabbit` Testcontainers support

- `StubbornRabbitContainerConfiguration` provides a `RabbitMQContainer` bean
- Container uses `@ServiceConnection` for auto-wired connection properties
- Container image configurable via `stubborn.messaging.rabbit.image`
- Configuration is conditional on Testcontainers being on classpath

### AC-6: `stubborn-messaging-rabbit` properties

- `stubborn.messaging.rabbit.receive-timeout` (default: 10s)
- `stubborn.messaging.rabbit.image` (default: `rabbitmq:4-management-alpine`)

## User Experience

### Kafka

```java
// build.gradle.kts
testImplementation("sh.stubborn:stubborn-messaging-kafka")

// Test class — no manual setup needed
@SpringBootTest
@AutoConfigureStubRunner(
    ids = "order-service:+:stubs",
    stubsMode = StubRunnerProperties.StubsMode.REMOTE,
    repositoryRoot = "sccbroker://http://localhost:18080"
)
class ConsumerTest {
    @Autowired StubTrigger stubTrigger;

    @Test
    void should_process_verification_message() {
        stubTrigger.trigger("accepted_verification");
        // assert consumer processed the message
    }
}
```

### RabbitMQ

Same pattern, just swap the dependency to `stubborn-messaging-rabbit`.

## Out of Scope

- Message schema validation (future)
- Multi-broker support within a single test
- Consumer contract testing (only producer-side verification)

## Dependencies

- Phase 1: Broker topic topology (complete)
- Spring Cloud Contract 5.0.2 `MessageVerifierSender` / `MessageVerifierReceiver`
- Spring Boot 4.0.3 `@ServiceConnection` for Testcontainers
