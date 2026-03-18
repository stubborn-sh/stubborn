# Spring Boot 4.x Tracing Test Starters

**Category:** Testing / Dependencies
**Last Updated:** 2026-02-26

## Related Files
- `broker/pom.xml`, `proxy/pom.xml` — test dependencies (versions in root `pom.xml`)
- Any `@WebMvcTest` or other sliced test that needs `Tracer`

## Findings

### 2026-02-26: NEVER mock Tracer in tests — use dedicated test starters

**Problem:** When `GlobalExceptionHandler` (or any bean) depends on `io.micrometer.tracing.Tracer`,
`@WebMvcTest` fails with `UnsatisfiedDependencyException: No qualifying bean of type 'io.micrometer.tracing.Tracer'`.

**WRONG approach:** Adding `@MockitoBean Tracer tracer` to each test class.

**CORRECT approach:** Spring Boot 4.x provides dedicated test starters:

```xml
<!-- For tracing test support (provides @AutoConfigureTracing, no-op Tracer) -->
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-micrometer-tracing-test</artifactId>
    <scope>test</scope>
</dependency>

<!-- For OpenTelemetry test support -->
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-opentelemetry-test</artifactId>
    <scope>test</scope>
</dependency>
```

Then annotate sliced tests with:

```java
@WebMvcTest(MyController.class)
@AutoConfigureTracing  // from spring-boot-micrometer-tracing-test
class MyControllerTest {
    // Tracer is now available as a no-op bean
}
```

**Key points:**
- `@AutoConfigureTracing` auto-configures a no-op `Tracer` (not a mock)
- Data exporting is NOT supported in sliced tests — by design
- For `@SpringBootTest`, tracing reporting components are also not auto-configured unless you add `@AutoConfigureTracing`
- This pattern applies to ALL sliced tests (`@WebMvcTest`, `@DataJpaTest`, etc.) that need tracing beans

### Spring Boot 4.x Observability Dependencies (correct)

**Main app:**
```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-opentelemetry</artifactId>
</dependency>
```

**Tests:**
```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-micrometer-tracing-test</artifactId>
    <scope>test</scope>
</dependency>
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-opentelemetry-test</artifactId>
    <scope>test</scope>
</dependency>
```

## Change Log

| Date | Change |
|------|--------|
| 2026-02-26 | Initial discovery -- NEVER mock Tracer, use test starters + @AutoConfigureTracing |
| 2026-02-27 | Updated file paths for multi-module restructure |
