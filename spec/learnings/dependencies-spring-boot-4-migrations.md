# Spring Boot 4.x Migration — Key Findings

**Category:** Dependencies
**Last Updated:** 2026-02-26

## Related Files
- Root `pom.xml` — centralized version management
- `broker/pom.xml`, `proxy/pom.xml` — module dependencies
- All test files using SB4 test annotations

## Findings

### 2026-02-26: RestTemplate/TestRestTemplate is DEPRECATED — use RestClient

**Problem:** `RestTemplate` and `TestRestTemplate` are deprecated in Spring Boot 4.x.

**CORRECT approach:** Use `RestClient` for production code and tests.

- For E2E tests: Use `RestClient` with `@AutoConfigureRestClient` or `WebTestClient`
- For production HTTP clients: Use `RestClient.builder()` (not `RestTemplate`)

### 2026-02-26: Test annotations moved to separate modules

In Spring Boot 4.x, test annotations moved to new modules:

| Annotation | Old Package | New Module | New Package |
|---|---|---|---|
| `@WebMvcTest` | `o.s.b.test.autoconfigure.web.servlet` | `spring-boot-starter-webmvc-test` | `o.s.b.webmvc.test.autoconfigure` |
| `@DataJpaTest` | `o.s.b.test.autoconfigure.orm.jpa` | `spring-boot-starter-data-jpa-test` | `o.s.b.data.jpa.test.autoconfigure` |
| `AutoConfigureTestDatabase` | `o.s.b.test.autoconfigure.jdbc` | `spring-boot-starter-jdbc-test` | `o.s.b.jdbc.test.autoconfigure` |

### 2026-02-26: Flyway auto-configuration moved to spring-boot-flyway

`@DataJpaTest` does NOT auto-configure Flyway in SB4. Need:
```java
@DataJpaTest
@ImportAutoConfiguration(FlywayAutoConfiguration.class) // from spring-boot-flyway module
```

### 2026-02-26: Tracing test starters

NEVER mock `Tracer` — use dedicated test starters:
```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-micrometer-tracing-test</artifactId>
    <scope>test</scope>
</dependency>
```
Then annotate sliced tests with `@AutoConfigureTracing`.

### 2026-02-26: Parallel test execution — methods must be same_thread

```properties
junit.jupiter.execution.parallel.mode.default=same_thread       # methods sequential (shared mocks!)
junit.jupiter.execution.parallel.mode.classes.default=concurrent # classes parallel
```
Methods within a class sharing `@MockitoBean` mocks CANNOT run concurrently.

### 2026-03-01: @WebMvcTest import confirmed across modules

The `@WebMvcTest` package move (`o.s.b.webmvc.test.autoconfigure.WebMvcTest`) was confirmed when adding
`broker-mcp-server` module. Using the old import `o.s.b.test.autoconfigure.web.servlet.WebMvcTest` fails
with `package does not exist`. The `spring-boot-starter-webmvc-test` dependency provides the new location.

### 2026-03-01: spring-boot-starter-aop renamed to spring-boot-starter-aspectj

In Spring Boot 4.x:
- **Old:** `spring-boot-starter-aop`
- **New:** `spring-boot-starter-aspectj`

### 2026-03-01: Jackson 3.x — ObjectMapper replaced by JsonMapper

**CRITICAL:** Spring Boot 4.x uses Jackson 3.x (`tools.jackson` namespace). The auto-configured JSON mapper
is now `tools.jackson.databind.json.JsonMapper`, NOT `com.fasterxml.jackson.databind.ObjectMapper`.

| Aspect | Jackson 2.x (Spring Boot 3.x) | Jackson 3.x (Spring Boot 4.x) |
|--------|-------------------------------|-------------------------------|
| Main mapper class | `com.fasterxml.jackson.databind.ObjectMapper` | `tools.jackson.databind.json.JsonMapper` |
| Package prefix | `com.fasterxml.jackson` | `tools.jackson` |
| Auto-configured bean | `ObjectMapper` | `JsonMapper` |
| Checked exceptions | `JsonProcessingException` (checked) | `JacksonException` (unchecked/runtime) |
| Builder pattern | `new ObjectMapper()` | `JsonMapper.builder().build()` |

**Symptom:** `NoSuchBeanDefinitionException: No qualifying bean of type 'com.fasterxml.jackson.databind.ObjectMapper'`
when a `@Component` injects `ObjectMapper` via constructor.

**Fix:** Change injection from `ObjectMapper` to `JsonMapper`:
```java
// WRONG (Spring Boot 4)
import com.fasterxml.jackson.databind.ObjectMapper;
MyService(ObjectMapper objectMapper) { }

// CORRECT (Spring Boot 4)
import tools.jackson.databind.json.JsonMapper;
MyService(JsonMapper jsonMapper) { }
```

**Note:** Both Jackson 2.x and 3.x JARs coexist on the classpath (2.20.x is the compatibility bridge).
Spring Boot 4 only auto-configures the Jackson 3 `JsonMapper` bean. The old `ObjectMapper` is NOT a bean.

**Files affected:** `broker/.../webhook/WebhookDispatcher.java` (fixed 2026-03-01)

### 2026-03-01: RestClient.Builder requires spring-boot-restclient module

**CRITICAL:** In Spring Boot 4.x, `RestClient.Builder` auto-configuration is in the separate `spring-boot-restclient`
module, NOT in `spring-boot-starter-web` or `spring-boot-autoconfigure`.

`spring-boot-starter-web` does NOT transitively include `spring-boot-restclient`. Test starters (e.g.
`spring-boot-starter-webmvc-test`) DO include it in test scope, which masks the issue during testing.

**Symptom:** Application starts fine in `@SpringBootTest` but fails in Docker/production with:
```
No qualifying bean of type 'org.springframework.web.client.RestClient$Builder' available
```

**Fix:** Add explicit dependency:
```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-restclient</artifactId>
</dependency>
```

**Related modules in SB4:** `spring-boot-restclient` depends on `spring-boot-http-client`.

**Files affected:** `broker/pom.xml` (fixed 2026-03-01)

## Change Log

| Date | Change |
|------|--------|
| 2026-02-26 | Initial discovery -- SB4 migration gotchas |
| 2026-02-27 | Updated file paths for multi-module restructure |
| 2026-03-01 | Added @WebMvcTest import confirmation from broker-mcp-server, aspectj rename |
| 2026-03-01 | Added Jackson 3 migration: ObjectMapper -> JsonMapper |
| 2026-03-01 | Added RestClient.Builder requires spring-boot-restclient module |
