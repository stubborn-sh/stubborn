# Observability in Spring Boot 4.x

**Category:** Observability / Dependencies
**Last Updated:** 2026-03-01

## Related Files
- `broker/src/main/java/.../observability/BrokerGauges.java` — custom business gauges
- `broker/src/main/java/.../application/ApplicationService.java` — `@Observed`
- `broker/src/main/java/.../contract/ContractService.java` — `@Observed`
- `broker/src/main/java/.../verification/VerificationService.java` — `@Observed`
- `broker/src/main/java/.../environment/DeploymentService.java` — `@Observed`
- `broker/src/main/java/.../safety/CanIDeployService.java` — `@Observed`
- `broker/src/main/java/.../graph/DependencyGraphService.java` — `@Observed`
- `broker/src/test/java/.../observability/BrokerGaugesTest.java` — gauge registration tests
- `broker/src/test/java/.../observability/ObservedAnnotationTest.java` — annotation presence tests

## Findings

### 2026-03-01: @Observed annotation for business metrics

**Pattern:** Use `@Observed(name = "broker.<feature>.<action>")` on service methods for automatic timers, counters, and trace spans.

```java
@Observed(name = "broker.contract.publish")
@Transactional
public Contract publish(String applicationName, String version, ...) { ... }
```

**What @Observed provides automatically:**
- Timer (latency p50/p95/p99) — `broker.contract.publish` metric
- Counter (total calls + errors) — derived from timer
- Trace span — for distributed tracing correlation

**Requirements:**
- `spring-boot-starter-opentelemetry` on classpath (Boot 4.x — replaces micrometer-tracing-bridge)
- `spring-boot-starter-aspectj` for AOP proxy (NOT `spring-boot-starter-aop` — renamed in Boot 4)
- `io.micrometer:micrometer-observation` (transitive from opentelemetry starter)

**Key point:** `@Observed` replaces the need for manual `Timer.start()`/`Counter.increment()` boilerplate. One annotation gives three types of telemetry.

### 2026-03-01: Custom gauges with BrokerGauges component

**Pattern:** For static/computed metrics that aren't tied to method calls, create a `@Component` that registers gauges at startup.

```java
@Component
class BrokerGauges {
    BrokerGauges(MeterRegistry registry, ApplicationService appService, ...) {
        Gauge.builder("broker.applications.total", appService::count)
            .description("Total number of registered applications")
            .register(registry);
    }
}
```

**Important:** Gauge suppliers use lazy evaluation (method references). The supplier is called when the metric is scraped, not at registration time.

### 2026-03-01: Testing @Observed annotations

**Two test strategies:**

1. **Reflection-based** (`ObservedAnnotationTest`) — verifies annotation presence and correct observation names without needing Spring context
2. **MeterRegistry-based** (`BrokerGaugesTest`) — uses `SimpleMeterRegistry` to verify gauge registration and values

**Gotcha with gauge tests:** Mockito strict stubbing fails because gauge suppliers are lazy — each test only triggers one supplier, making the others "unnecessary". Fix: use `@MockitoSettings(strictness = Strictness.LENIENT)`.

### 2026-03-01: Spring Boot 4.x observability dependency changes

| Spring Boot 3.x | Spring Boot 4.x | Purpose |
|------------------|------------------|---------|
| `micrometer-tracing-bridge-otel` | `spring-boot-starter-opentelemetry` | OTLP export |
| `spring-boot-starter-aop` | `spring-boot-starter-aspectj` | AOP proxying for @Observed |
| Manual `@EnableObservability` | Auto-configured | Observation auto-config |

**Boot 4.x auto-configures ObservationRegistry** when micrometer-observation is on classpath. No explicit `@EnableObservability` needed.

### 2026-03-01: Actuator endpoint exposure for observability

```yaml
management:
  endpoints:
    web:
      exposure:
        include: health,prometheus  # prometheus for metric scraping
  endpoint:
    health:
      show-details: never  # security: don't expose details
      probes:
        enabled: true  # K8s liveness/readiness probes
  observations:
    key-values:
      application: stubborn  # common tag for all metrics
```

**Security:** Only expose `health` and `prometheus` actuator endpoints. Never expose `env`, `configprops`, or `beans`.

### 2026-03-01: Low-cardinality tags for @Observed

When adding custom tags to observations, ensure values are low-cardinality (bounded set):
- **Good:** `status=SUCCESS|FAILED`, `contentType=yaml|json|groovy`
- **Bad:** `userId=<uuid>`, `contractName=<arbitrary-string>`

High-cardinality values cause metric explosion in time-series databases (Prometheus, InfluxDB).

## Change Log

| Date | Change |
|------|--------|
| 2026-03-01 | Initial discovery — @Observed pattern, BrokerGauges, testing strategies, Boot 4 changes |
