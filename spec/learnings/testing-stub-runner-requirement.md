# Testing: Broker Stubs Must Use Stub Runner

**Category:** Testing
**Last Updated:** 2026-02-28

## Related Files

- `broker/src/test/java/**/*ContractTest.java` — Contract tests that generate stubs
- `broker-contract-publisher/src/test/java/**/BrokerPublisherTest.java` — Consumer test using Stub Runner
- `broker/target/*-stubs.jar` — Generated stubs JAR

## Findings

### Requirement: No Manual WireMock Stubs for Broker API (2026-02-28)

**All broker API stubs must come from the broker's stubs JAR and be loaded via Spring Cloud Contract Stub Runner.** Manual WireMock `stubFor()` calls for broker API endpoints are prohibited.

**Exception:** Manual WireMock stubs are acceptable for testing error cases that cannot be represented by contracts, such as malformed HTTP chunks, connection resets, or other transport-level failures.

### Stub Distinguishability (2026-02-28)

When multiple contract tests produce stubs for the same HTTP endpoint (e.g., POST `/api/v1/applications`), each stub MUST use unique request data so WireMock can distinguish them when all stubs are loaded simultaneously:

- **201 Created**: app name `"order-service"`
- **409 Conflict**: app name `"existing-service"`
- **401 Unauthorized**: app name `"unauthenticated-service"`

Without unique request data, WireMock cannot determine which stub to use when multiple stubs match the same URL+method.

### Content-Type Matching (2026-02-28)

MockMvc-generated stubs expect `Content-Type: application/json;charset=UTF-8` (MockMvc adds charset automatically). REST consumers using `RestClient` send `application/json` by default. To match stubs, consumers must send `application/json;charset=UTF-8`:

```java
private static final MediaType JSON_UTF8 = new MediaType("application", "json", StandardCharsets.UTF_8);
// use .contentType(JSON_UTF8) in RestClient calls
```

### Generate-Stubs Tag (2026-02-28)

All 6 contract test classes in the broker module have `@Tag("generate-stubs")`. To regenerate stubs:

```bash
./mvnw test -pl broker -Dgroups=generate-stubs
```

### Never Skip Integration Tests (2026-02-28)

`mvnd clean install` MUST run without `-DskipITs`. Integration tests (Failsafe) are part of the build. If an IT fails, fix it — do not skip it.

### Testcontainers + @DynamicPropertySource Timing (2026-02-28)

When using `@DynamicPropertySource` with Testcontainers, do NOT use `@Container` + `@Testcontainers` for containers whose ports are referenced in dynamic properties. The Spring context may bind properties before the `@Testcontainers` extension starts the container. Instead, start the container manually in a `static {}` block:

```java
static final GenericContainer<?> container = new GenericContainer<>("image:latest")
    .withExposedPorts(4318);
static {
    container.start();
}
```

## Change Log

| Date | Change |
|------|--------|
| 2026-02-28 | Initial discovery: Stub Runner requirement, stub distinguishability, Content-Type matching |
| 2026-02-28 | Added: Never skip ITs, Testcontainers timing with @DynamicPropertySource |
