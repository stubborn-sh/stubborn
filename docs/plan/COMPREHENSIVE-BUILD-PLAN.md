# Stubborn — Comprehensive Build Plan

> Merged from: project-specific build prompt + all local Claude rules
> (`core.md`, `java-spring.md`, `testing.md`, `api-design.md`, `error-handling.md`,
> `security.md`, `database.md`, `observability.md`, `performance.md`,
> `code-style.md`, `controllers.md`, `git-workflow.md`, `legacy-code.md`,
> `learnings.md`, `exceptions.md`, `mcp.md`)
>
> Date: 2026-02-26

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Non-Negotiable Rules](#2-non-negotiable-rules)
3. [Technology Stack](#3-technology-stack)
4. [Project Structure](#4-project-structure)
5. [Development Workflow](#5-development-workflow)
6. [Static Analysis — 5 Tools from Day Zero](#6-static-analysis--5-tools-from-day-zero)
7. [The Test Pyramid — 6 Mandatory Layers](#7-the-test-pyramid--6-mandatory-layers)
8. [API Design Rules](#8-api-design-rules)
9. [Error Handling](#9-error-handling)
10. [Security](#10-security)
11. [Database & Migrations](#11-database--migrations)
12. [Observability](#12-observability)
13. [Controller Rules](#13-controller-rules)
14. [Code Style](#14-code-style)
15. [Git Workflow](#15-git-workflow)
16. [Feature Specifications](#16-feature-specifications)
17. [Feature Build Order](#17-feature-build-order)
18. [Feature 7: AI Traffic-to-Contract Proxy](#18-feature-7-ai-traffic-to-contract-proxy)
19. [Validation Checklist](#19-validation-checklist)
20. [Anti-Patterns](#20-anti-patterns)
21. [Learnings & Knowledge Base](#21-learnings--knowledge-base)
22. [Exception & Override Policy](#22-exception--override-policy)
23. [Resolved Conflicts Between Rule Sources](#23-resolved-conflicts-between-rule-sources)

---

## 1. Project Overview

**Stubborn** is a governance server for the Spring Cloud Contract
ecosystem — think Pact Broker but native to Spring Cloud Contract.

**Core capabilities:**
- Application registration (producers & consumers)
- Contract/stub publishing and versioning
- Verification result recording
- Environment tracking with deployed versions
- "Can I Deploy" safety checks
- Security with RBAC (ADMIN, PUBLISHER, READER)
- AI-powered traffic-to-contract proxy (LLM-based)

**Self-documenting:** The broker's own REST API is tested with MockMvc + Spring RestDocs,
which produces Spring Cloud Contract WireMock stubs. Anyone can use
`@AutoConfigureStubRunner(ids = "sh.stubborn:stubborn")`
to get a fake broker.

---

## 2. Non-Negotiable Rules

These rules come from BOTH the build prompt and local Claude rules. They are **CRITICAL**
priority — no exceptions, no overrides.

### 2.1 Workflow: SPEC -> TEST -> CODE -> VERIFY

```
1. Write SPEC          -> docs/specs/NNN-feature-name.md (Given/When/Then)
2. Write FAILING TESTS -> run them, confirm RED (unit + property + contract)
3. Write PRODUCTION CODE -> minimal code to make tests GREEN
4. REFACTOR            -> clean up, still GREEN
5. RUN FULL BUILD      -> ./mvnw clean verify
6. RUN MUTATION TESTS  -> ./mvnw org.pitest:pitest-maven:mutationCoverage
7. If surviving mutants -> write more tests until killed, go to step 5
8. SECURITY REVIEW     -> mandatory checklist (see Section 10)
9. UPDATE LEARNINGS    -> record key findings in spec/learnings/
10. NEXT FEATURE       -> go to step 1
```

If you ever write production code before a test exists — STOP, delete it, write the test first.

### 2.2 Absolute Rules (Never Excepted)

| Rule | Source |
|------|--------|
| No sensitive data in logs (passwords, tokens, PII, cards, sessions) | security.md + build prompt |
| No hardcoded secrets — always externalize via `@Value("${...}")` | security.md + build prompt |
| Bounded caches (`Caffeine.newBuilder().maximumSize(N)`) — never `ConcurrentHashMap` | java-spring.md |
| Bounded queues (`ArrayBlockingQueue`) — never unbounded `LinkedBlockingQueue` | java-spring.md |
| Spring-managed executors — never `CompletableFuture.runAsync()` without executor | java-spring.md |
| Entities never `public` — always package-private | java-spring.md |
| No `Thread.sleep()` in tests — use Awaitility | testing.md |
| Tests must actually run and pass — show output as proof | testing.md + build prompt |
| Never modify deployed Flyway migrations | database.md |
| Backward-compatible migrations (zero-downtime deploys) | database.md |
| Security review every change (OWASP top 10 checklist) | security.md |
| Don't swallow exceptions — handle or propagate | error-handling.md |
| Don't catch generic `Exception` — catch specific types | error-handling.md |
| Controllers are thin layers — no business logic | controllers.md |
| No static `SecurityContextHolder` access in controllers | controllers.md |
| No direct push to main/master | git-workflow.md |

---

## 3. Technology Stack

### 3.1 Exact Versions

```properties
# Runtime
java.version=17
spring-boot.version=4.0.2
spring-cloud-bom.version=2025.1.1
spring-cloud-contract.version=5.0.2

# Static Analysis (ALL 5 mandatory)
spring-javaformat.version=0.0.47
error-prone.version=2.47.0
spotbugs-maven-plugin.version=4.9.8.2
spotbugs.version=4.9.8
findsecbugs.version=1.13.0
pmd-plugin.version=3.26.0
pmd.version=7.11.0
checkstyle.version=10.21.4

# Testing
jqwik.version=1.9.3
pitest-maven.version=1.22.1
pitest-junit5-plugin.version=1.1.0
# Testcontainers, spring-security-test: from Spring Boot 4 BOM

# AI Module
swagger-request-validator.version=2.43.0
```

### 3.2 Dependencies

**Runtime:**
```xml
<!-- Core -->
<dependency>spring-boot-starter-web</dependency>
<dependency>spring-boot-starter-data-jpa</dependency>
<dependency>spring-boot-starter-validation</dependency>
<dependency>spring-boot-starter-actuator</dependency>
<dependency>postgresql (runtime)</dependency>
<dependency>flyway-core</dependency>
<dependency>flyway-database-postgresql</dependency>

<!-- Security -->
<dependency>spring-boot-starter-security</dependency>
<dependency>spring-boot-starter-oauth2-resource-server</dependency>

<!-- Contract/RestDocs (eat-own-dogfood) -->
<dependency>spring-restdocs-mockmvc</dependency>
<dependency>spring-cloud-contract-spec</dependency>
<dependency>spring-cloud-starter-contract-stub-runner (test)</dependency>

<!-- Observability -->
<dependency>micrometer-core</dependency>
<dependency>micrometer-observation</dependency>
<dependency>context-propagation</dependency>

<!-- AI Module -->
<dependency>spring-boot-starter-webflux</dependency>
<dependency>swagger-request-validator-core:2.43.0</dependency>
```

**Test:**
```xml
<dependency>spring-boot-starter-test</dependency>
<dependency>spring-boot-testcontainers</dependency>
<dependency>testcontainers:junit-jupiter</dependency>
<dependency>testcontainers:postgresql</dependency>
<dependency>net.jqwik:jqwik:${jqwik.version}</dependency>
<dependency>spring-security-test</dependency>
<dependency>wiremock-standalone</dependency>
<dependency>spring-restdocs-mockmvc</dependency>
```

### 3.3 Build Tool

**REQUIRED:** Always use the Maven wrapper.

```bash
# Correct
./mvnw test
./mvnw clean verify
mvnd test -T 1C  # Maven Daemon if available (RECOMMENDED for speed)

# Never
mvn test
```

### 3.4 Pinned Versions Only

```xml
<!-- REQUIRED -->
<version>4.0.2</version>

<!-- NEVER -->
<version>LATEST</version>
<version>[3.0,)</version>
```

---

## 4. Project Structure

### 4.1 Vertical Slice Architecture (REQUIRED)

```
src/main/java/org/springframework/cloud/contract/broker/
├── application/                    # Shared domain (registration, contracts, etc.)
│   ├── api/                        # Controllers, request/response DTOs
│   ├── application/                # Service layer
│   ├── domain/                     # Entities, value objects
│   └── infrastructure/             # Repositories, external clients
├── contract/                       # Contract publishing feature
│   ├── api/
│   ├── application/
│   ├── domain/
│   └── infrastructure/
├── verification/                   # Verification results feature
│   ├── api/
│   ├── application/
│   ├── domain/
│   └── infrastructure/
├── environment/                    # Environment tracking feature
│   ├── api/
│   ├── application/
│   ├── domain/
│   └── infrastructure/
├── safety/                         # Can-I-Deploy feature
│   ├── api/
│   ├── application/
│   ├── domain/
│   └── infrastructure/
├── security/                       # Security cross-cutting
│   └── (SecurityConfig, GlobalExceptionHandler, etc.)
├── proxy/                          # AI Traffic-to-Contract proxy module
│   ├── api/
│   ├── application/
│   ├── domain/
│   └── infrastructure/
└── BrokerApplication.java

src/main/resources/
├── application.yml
├── application-local.yml
├── application-test.yml
├── db/migration/
│   ├── V1__create_applications_table.sql
│   ├── V2__create_contracts_table.sql
│   └── ...
└── prompts/                         # LLM prompt templates (version-controlled)
    └── traffic-to-contract.txt

src/test/java/.../broker/
├── application/
│   ├── ApplicationServiceTest.java              # Unit (Layer 1)
│   ├── ApplicationNameProperties.java           # Property (Layer 2)
│   ├── ApplicationControllerTest.java           # Slice (Layer 3a)
│   ├── ApplicationRepositoryTest.java           # Repository (Layer 3b)
│   ├── ApplicationControllerContractTest.java   # Contract+RestDocs (Layer 4)
│   └── ApplicationRegistrationE2ETest.java      # E2E (Layer 5)
├── ...
└── (PITest runs automatically — Layer 6)

src/test/resources/
├── junit-platform.properties        # Parallel execution config
└── ...
```

### 4.2 Specification & Documentation Structure

```
docs/
├── specs/
│   ├── 001-application-registration.md
│   ├── 002-contract-publishing.md
│   ├── 003-verification-results.md
│   ├── 004-environment-tracking.md
│   ├── 005-can-i-deploy.md
│   ├── 006-security.md
│   └── 007-ai-traffic-proxy.md
└── plan/
    └── COMPREHENSIVE-BUILD-PLAN.md   # This file

spec/
├── features/
│   └── README.md                     # Feature index
├── contracts/
│   └── openapi.yaml                  # OpenAPI spec (spec-first)
├── decisions/
│   └── NNNN-<title>.md               # Architecture Decision Records
└── learnings/
    ├── README.md                     # Learnings index
    ├── _template.md                  # Learning template
    └── <category>-<topic>.md         # Key findings
```

### 4.3 Visibility Rules

| Element | Visibility | Exception |
|---------|-----------|-----------|
| Domain entities | Package-private | Never public |
| Value objects | Package-private | — |
| Services | Package-private | Public only if cross-feature facade |
| Repositories | Package-private | — |
| Controllers | Package-private | — |
| DTOs (request/response) | Package-private or public | Public if shared across features |
| Configuration classes | Public | Required by Spring |

---

## 5. Development Workflow

### 5.1 Per-Feature Workflow

```
0. CHECK spec/learnings/ for relevant existing knowledge
1. Is this a behavior change?
   ├── NO (build/config/refactor) -> Skip spec, proceed
   └── YES -> Does spec exist?
              ├── NO  -> Create high-level spec first (docs/specs/NNN-*.md)
              └── YES -> Continue
2. Define OpenAPI contract in spec/contracts/openapi.yaml (spec-first)
3. Write acceptance tests (must FAIL — RED)
   - Unit test (parameterized)
   - Property-based test (jqwik)
   - Controller slice test
   - Contract test (MockMvc + RestDocs + SCC stubs)
   - E2E test (for core flows)
4. Implement until tests pass (GREEN)
5. Refactor (still GREEN)
6. Run ./mvnw spring-javaformat:apply
7. Run ./mvnw clean verify (includes all 5 static analysis tools)
8. Run ./mvnw failsafe:integration-test failsafe:verify (Docker tests)
9. Run ./mvnw org.pitest:pitest-maven:mutationCoverage (>= 80%)
10. Security review (mandatory checklist)
11. Verify stubs JAR produced: ls target/*-stubs.jar
12. Update spec/learnings/ if key findings discovered
13. Commit (atomic, tests pass)
14. Next feature
```

### 5.2 When Specs Can Be Skipped

| Situation | Action |
|-----------|--------|
| User explicitly says "skip the spec" | Honor, document skip, recommend follow-up |
| Trivial change (typo, log update) | Skip spec |
| Build/infrastructure (Dockerfile, CI) | Skip spec |
| Configuration (properties, flags) | Skip spec |
| Refactoring (behavior unchanged) | Skip spec |

---

## 6. Static Analysis — 5 Tools from Day Zero

All `failOnError=true` / `failOnViolation=true`. The build MUST fail if ANY tool reports a violation.

| # | Tool | Plugin | Version | Phase | Purpose |
|---|------|--------|---------|-------|---------|
| 1 | **Spring Java Format** | `io.spring.javaformat:spring-javaformat-maven-plugin` | `0.0.47` | `validate` | Spring-standard formatting |
| 2 | **Checkstyle** | `maven-checkstyle-plugin` + `spring-javaformat-checkstyle` | `0.0.47` / `10.21.4` | `validate` | Code style enforcement |
| 3 | **Error Prone** | `com.google.errorprone:error_prone_core` via compiler | `2.47.0` | `compile` | Compile-time bug detection |
| 4 | **SpotBugs** | `com.github.spotbugs:spotbugs-maven-plugin` + FindSecBugs | `4.9.8.2` / `1.13.0` | `verify` | Runtime bug + security detection |
| 5 | **PMD** | `maven-pmd-plugin` + `pmd-java` | `3.26.0` / `7.11.0` | `verify` | Code quality rules |

**Pre-commit:** Run `./mvnw spring-javaformat:apply` before every commit.

**Suppression policy:** Do NOT suppress static analysis warnings without documented justification.

---

## 7. The Test Pyramid — 6 Mandatory Layers

AI-generated code needs maximum guardrails. Each layer catches different failure modes.

### Layer 1: Unit Tests (JUnit 5 + AssertJ)

**Pattern:** `*Test.java` — Naming: `{ClassUnderTest}Test.java`
**What:** Single class in isolation. Mocked dependencies via Mockito.
**Speed:** Milliseconds. No Spring context. No Docker. No I/O.
**Assertions:** AssertJ ONLY — never JUnit5 `assertEquals`/`assertTrue`.

**REQUIRED conventions (from local rules):**
- BDD naming: `should_<expected_outcome>_when_<condition>`
- BDD structure: `// given` / `// when` / `// then`
- ALWAYS use `@ParameterizedTest` when testing multiple scenarios for the same behavior
  (consolidate — don't write separate test methods for each case)

```java
// BAD — AI tends to generate separate methods:
@Test void rejectsEmptyName() { ... }
@Test void rejectsNameWithSpaces() { ... }

// GOOD — consolidated:
@ParameterizedTest(name = "rejects invalid name: \"{0}\"")
@ValueSource(strings = {"", " ", "has spaces", "has.dots", "has@special"})
void should_reject_when_name_is_invalid(String invalidName) {
    assertThat(ApplicationName.isValid(invalidName)).isFalse();
}
```

Use `@ValueSource`, `@CsvSource`, `@MethodSource`, `@EnumSource` as appropriate.

### Layer 2: Property-Based Tests (jqwik 1.9.3)

**Pattern:** `*Properties.java` — Naming: `{ClassUnderTest}Properties.java`
**What:** Invariants that hold for ALL valid inputs (1000 random cases).
**Speed:** Seconds.

**MANDATORY for:**
- Domain entity validation (names, versions, etc.)
- Any method with boundary conditions
- Serialization/deserialization roundtrips
- Business rules (can-i-deploy logic)
- Security invariants (redaction, auth)

```java
@Property
void should_accept_any_valid_name(
        @ForAll @From("validApplicationNames") String name) {
    assertThat(ApplicationName.isValid(name)).isTrue();
}

@Property
void should_roundtrip_serialize(
        @ForAll @From("validApplicationNames") String name) {
    ApplicationName original = new ApplicationName(name);
    String json = objectMapper.writeValueAsString(original);
    ApplicationName deserialized = objectMapper.readValue(json, ApplicationName.class);
    assertThat(deserialized).isEqualTo(original);
}
```

### Layer 3: Test Slices — Integration Tests of Edges ONLY

Each edge tested in isolation. One integration point per slice.

#### 3a: Controller Slice — `@WebMvcTest`

**Pattern:** `*ControllerTest.java`
**What:** Real Spring MVC + Jackson + validation, MOCKED service layer.
No database, no network, no other controllers.

#### 3b: Repository Slice — `@DataJpaTest` + Testcontainers PostgreSQL

**Pattern:** `*RepositoryTest.java`
**What:** Real JPA + real PostgreSQL (Testcontainers) + real Flyway.
No controllers, no services. Tests the database edge only.

```java
@DataJpaTest
@Testcontainers
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
class ApplicationRepositoryTest {
    @Container
    @ServiceConnection
    static PostgreSQLContainer<?> postgres =
        new PostgreSQLContainer<>("postgres:16-alpine");
    // ...
}
```

**NEVER use H2 for PostgreSQL-targeted code** (from local testing.md).

#### 3c: HTTP Client Slice — WireMock

**Pattern:** `*ClientTest.java`
**What:** Real HTTP client, WireMock stubs for external APIs (LLM API).

### Layer 4: Contract Tests — MockMvc + RestDocs + Spring Cloud Contract Stubs

**Pattern:** `*ContractTest.java`
**What:** Produces RestDocs snippets AND Spring Cloud Contract stubs.
**Every REST endpoint MUST have at least one contract test.**

```java
@WebMvcTest(ApplicationController.class)
@AutoConfigureRestDocs(outputDir = "target/generated-snippets")
class ApplicationControllerContractTest {
    @Test
    void shouldRegisterApplication() throws Exception {
        mockMvc.perform(post("/api/applications")
                .contentType(APPLICATION_JSON)
                .content("""..."""))
            .andExpect(status().isCreated())
            .andDo(document("register-application",
                SpringCloudContractRestDocs.dslContract()));
    }
}
```

### Layer 5: End-to-End Tests — Full Stack + Testcontainers

**Pattern:** `*E2ETest.java`
**What:** Full Spring context, real PostgreSQL, real HTTP via `TestRestTemplate`. NO mocks.
**Run via `maven-failsafe-plugin`** (separate from unit tests).

```java
@SpringBootTest(webEnvironment = WebEnvironment.RANDOM_PORT)
@Testcontainers
class CanIDeployE2ETest {
    @Container @ServiceConnection
    static PostgreSQLContainer<?> postgres =
        new PostgreSQLContainer<>("postgres:16-alpine");

    @Autowired private TestRestTemplate restTemplate;

    @Test
    void fullCanIDeployFlow() {
        // 1. Register apps -> 2. Publish contracts -> 3. Record verification
        // -> 4. Create environment + deploy -> 5. Can I deploy? -> assert true
    }
}
```

### Layer 6: Mutation Tests (PITest 1.22.1)

**Config:** `STRONGER` mutators, `80%` mutation threshold.
**Run:** `./mvnw org.pitest:pitest-maven:mutationCoverage`

Catches the #1 AI test problem: tests that call methods without meaningful assertions.

### Surefire + Failsafe Separation

```xml
<!-- Surefire: fast tests (unit, property, controller slice, contract) -->
<includes>**/*Test.java, **/*Tests.java, **/*Properties.java</includes>
<excludes>**/*E2ETest.java, **/*IntegrationTest.java</excludes>

<!-- Failsafe: slow tests needing Docker (repository, E2E) -->
<includes>**/*E2ETest.java, **/*IntegrationTest.java, **/*RepositoryTest.java</includes>
```

### Test Isolation (REQUIRED)

- No shared mutable state between tests
- No hardcoded ports — use `@SpringBootTest(webEnvironment = RANDOM_PORT)`
- No shared files — use temp directories
- No test order dependencies

### Parallel Test Execution (REQUIRED)

```properties
# src/test/resources/junit-platform.properties
junit.jupiter.execution.parallel.enabled=true
junit.jupiter.execution.parallel.mode.default=concurrent
junit.jupiter.execution.parallel.mode.classes.default=concurrent
```

### Reuse Testcontainers (RECOMMENDED)

```java
abstract class AbstractIntegrationTest {
    static final PostgreSQLContainer<?> postgres;
    static {
        postgres = new PostgreSQLContainer<>("postgres:16-alpine");
        postgres.start();
    }
}
```

---

## 8. API Design Rules

### 8.1 URL Versioning (REQUIRED)

Version from day one, even for v1:

```
/api/v1/applications
/api/v1/applications/{name}/versions/{version}/contracts
/api/v1/verifications
/api/v1/environments
/api/v1/can-i-deploy
```

### 8.2 Resource-Based URLs (REQUIRED)

```
# Nouns, not verbs
GET    /api/v1/applications
GET    /api/v1/applications/{name}
POST   /api/v1/applications
DELETE /api/v1/applications/{name}

# Plural always
/api/v1/applications   (not /api/v1/application)
/api/v1/environments   (not /api/v1/environment)
/api/v1/verifications  (not /api/v1/verification)
```

### 8.3 Nested Resources (REQUIRED, max depth 2)

```
GET  /api/v1/applications/{name}/versions/{version}/contracts
POST /api/v1/applications/{name}/versions/{version}/contracts
GET  /api/v1/environments/{name}/deployed-versions
POST /api/v1/environments/{name}/deployed-versions
```

### 8.4 HTTP Methods (REQUIRED)

| Method | Purpose | Idempotent |
|--------|---------|------------|
| GET | Read | Yes |
| POST | Create | No |
| PUT | Replace | Yes |
| PATCH | Partial update | Yes |
| DELETE | Remove | Yes |

PUT and DELETE MUST be idempotent.

### 8.5 HTTP Status Codes (REQUIRED)

| Status | When |
|--------|------|
| 200 OK | Successful GET, PUT, PATCH |
| 201 Created | Successful POST (with Location header) |
| 204 No Content | Successful DELETE |
| 400 Bad Request | Validation error |
| 401 Unauthorized | Not authenticated |
| 403 Forbidden | Not authorized for role |
| 404 Not Found | Resource doesn't exist |
| 409 Conflict | State conflict (duplicate name, etc.) |
| 500 Internal Error | Unexpected server error |

### 8.6 Location Header for 201 (REQUIRED)

```java
return ResponseEntity
    .created(URI.create("/api/v1/applications/" + app.getName()))
    .body(ApplicationResponse.from(app));
```

### 8.7 JSON Conventions (REQUIRED)

- `camelCase` field names
- ISO 8601 dates: `"2026-02-26T10:30:00Z"`
- `APPLICATION_JSON` for content types

### 8.8 Pagination (REQUIRED for list endpoints)

```
GET /api/v1/applications?page=0&size=20&sort=createdAt,desc
```

Response:
```json
{
    "content": [...],
    "page": 0,
    "size": 20,
    "totalElements": 100,
    "totalPages": 5
}
```

### 8.9 Filtering (REQUIRED)

```
GET /api/v1/applications?owner=team-orders
GET /api/v1/verifications?producer=order-service&status=SUCCESS
```

### 8.10 OpenAPI Specification (REQUIRED)

- Define API in `spec/contracts/openapi.yaml` BEFORE implementation (spec-first)
- Document all endpoints with `@Operation` / `@ApiResponses`

---

## 9. Error Handling

### 9.1 Domain-Specific Exceptions (REQUIRED)

```java
// REQUIRED: Specific domain exceptions
class ApplicationNotFoundException extends RuntimeException {
    private final String applicationName;
    ApplicationNotFoundException(String applicationName) {
        super("Application not found: " + applicationName);
        this.applicationName = applicationName;
    }
}

class ApplicationAlreadyExistsException extends RuntimeException { }
class ContractValidationException extends RuntimeException { }
class VerificationNotFoundException extends RuntimeException { }
class EnvironmentNotFoundException extends RuntimeException { }
```

### 9.2 Exception Hierarchy (RECOMMENDED)

```
BusinessException (abstract)
├── NotFoundException
│   ├── ApplicationNotFoundException
│   ├── ContractNotFoundException
│   ├── VerificationNotFoundException
│   └── EnvironmentNotFoundException
├── ValidationException
│   ├── InvalidApplicationNameException
│   ├── InvalidVersionException
│   └── ContractValidationException
└── ConflictException
    ├── ApplicationAlreadyExistsException
    ├── EnvironmentAlreadyExistsException
    └── DuplicateContractException
```

### 9.3 Consistent Error Response (REQUIRED)

```java
record ErrorResponse(
    String code,                    // Machine-readable: "APPLICATION_NOT_FOUND"
    String message,                 // Human-readable: "Application not found"
    String traceId,                 // For debugging
    Instant timestamp,
    Map<String, String> details     // Optional field-level errors
) {}
```

### 9.4 Global Exception Handler (REQUIRED)

```java
@RestControllerAdvice
class GlobalExceptionHandler {
    @ExceptionHandler(NotFoundException.class)       // -> 404
    @ExceptionHandler(ValidationException.class)     // -> 400
    @ExceptionHandler(ConflictException.class)       // -> 409
    @ExceptionHandler(AccessDeniedException.class)   // -> 403
    @ExceptionHandler(Exception.class)               // -> 500 (log full trace, hide details)
}
```

### 9.5 Logging Rules

| Level | When | Example |
|-------|------|---------|
| ERROR | Unexpected failures | `log.error("DB connection failed", exception)` |
| WARN | Expected failures | `log.warn("Validation failed: {}", errors)` |
| INFO | Business events | `log.info("Application registered: {}", name)` |
| DEBUG | Troubleshooting | `log.debug("Query returned {} results", count)` |

**ALWAYS log with context IDs:**
```java
log.error("Contract publishing failed. app={}, version={}", appName, version, exception);
```

### 9.6 Wrap External Exceptions (REQUIRED)

```java
// For LLM client, external services:
try {
    return llmClient.generateContract(traffic);
} catch (RestClientException e) {
    throw new LlmApiException("LLM service call failed", e);
}
```

---

## 10. Security

### 10.1 Requirements (from docs/specs/006-security.md)

| ID | Requirement |
|----|-------------|
| REQ-006-1 | All endpoints require auth except `/actuator/health` |
| REQ-006-2 | HTTP Basic auth + OAuth2/OIDC bearer tokens |
| REQ-006-3 | RBAC: `ADMIN`, `PUBLISHER`, `READER` |
| REQ-006-4 | API token support for CI/CD |
| REQ-006-5 | Audit log: every mutation logged (who, when, what) |
| REQ-006-6 | CSRF disabled for API, CORS configurable |
| REQ-006-7 | Rate limiting on writes |

### 10.2 Role Matrix

| Action | READER | PUBLISHER | ADMIN |
|--------|--------|-----------|-------|
| Browse applications | Yes | Yes | Yes |
| Download contracts/stubs | Yes | Yes | Yes |
| Can-I-Deploy queries | Yes | Yes | Yes |
| Register applications | No | Yes | Yes |
| Upload contracts | No | Yes | Yes |
| Record verifications | No | Yes | Yes |
| Manage environments | No | No | Yes |
| Manage users/tokens | No | No | Yes |

### 10.3 Security Test Strategy

**Parameterized security matrix — THE most important security test:**

```java
@WebMvcTest
@Import(SecurityConfig.class)
class SecurityMatrixTest {
    @ParameterizedTest(name = "{0} {1} as {2} -> {3}")
    @CsvSource({
        "GET,    /api/v1/applications,       ANONYMOUS,  401",
        "POST,   /api/v1/applications,       ANONYMOUS,  401",
        "GET,    /actuator/health,           ANONYMOUS,  200",
        "GET,    /api/v1/applications,       READER,     200",
        "POST,   /api/v1/applications,       READER,     403",
        "POST,   /api/v1/applications,       PUBLISHER,  201",
        "POST,   /api/v1/environments,       PUBLISHER,  403",
        "POST,   /api/v1/environments,       ADMIN,      201",
        // ... full matrix
    })
    void securityMatrix(String method, String path, String role, int expected) { }
}
```

**Property test — no unauth access:**
```java
@Property
void should_reject_unauthenticated_access_to_all_api_endpoints(
        @ForAll @From("allBrokerEndpoints") EndpointDescriptor endpoint) {
    Assume.that(!endpoint.path().startsWith("/actuator/health"));
    mockMvc.perform(request(endpoint.method(), endpoint.path()))
        .andExpect(status().isUnauthorized());
}
```

### 10.4 Security Config (REQUIRED)

```java
@Configuration
@EnableWebSecurity
@EnableMethodSecurity
class SecurityConfig {
    @Bean
    SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        return http
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/actuator/health/**").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/**").hasAnyRole("READER", "PUBLISHER", "ADMIN")
                .requestMatchers(HttpMethod.POST, "/api/v1/environments/**").hasRole("ADMIN")
                .requestMatchers(HttpMethod.POST, "/api/**").hasAnyRole("PUBLISHER", "ADMIN")
                .anyRequest().authenticated()
            )
            .csrf(csrf -> csrf.disable())  // API-only
            .oauth2ResourceServer(oauth2 -> oauth2.jwt(Customizer.withDefaults()))
            .httpBasic(Customizer.withDefaults())
            .build();
    }
}
```

### 10.5 Controller Security (CRITICAL)

```java
// GOOD — method-injected security info
@PostMapping
ResponseEntity<ApplicationResponse> register(
        @Valid @RequestBody CreateApplicationRequest request,
        @AuthenticationPrincipal Jwt jwt) {
    Application app = applicationService.register(request, jwt.getSubject());
    return ResponseEntity.created(...).body(ApplicationResponse.from(app));
}

// BAD — static context access (NEVER)
SecurityContextHolder.getContext().getAuthentication();
```

### 10.6 Actuator Lockdown (REQUIRED)

```yaml
management:
  endpoints:
    web:
      exposure:
        include: health
  endpoint:
    health:
      show-details: never
      probes:
        enabled: true
```

### 10.7 Input Validation (REQUIRED)

```java
record CreateApplicationRequest(
    @NotBlank @Size(max = 128) @Pattern(regexp = "^[a-zA-Z0-9-]+$")
    String name,
    @Size(max = 500) String description,
    @Size(max = 100) String owner
) {}
```

### 10.8 Mandatory Security Checklist (every change)

- [ ] No injection vulnerabilities (SQL, command, XSS)
- [ ] No sensitive data exposure (logs, responses)
- [ ] Authentication/authorization correct
- [ ] Input validated at system boundary
- [ ] No insecure dependencies (CVEs)
- [ ] Parameterized queries (never string concat)
- [ ] FindSecBugs passes (SpotBugs + security plugin)

---

## 11. Database & Migrations

### 11.1 Flyway (REQUIRED)

```
src/main/resources/db/migration/
├── V1__create_applications_table.sql
├── V2__create_contracts_table.sql
├── V3__create_verifications_table.sql
├── V4__create_environments_table.sql
├── V5__create_deployed_versions_table.sql
├── V6__create_audit_log_table.sql
└── ...
```

### 11.2 Naming Convention

```
V<version>__<description>.sql
V1__create_applications_table.sql
```

- Integer or decimal version
- Double underscore separator
- `snake_case` description
- One change per migration

### 11.3 Standard Columns (REQUIRED)

```sql
CREATE TABLE applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(128) NOT NULL,
    description TEXT,
    owner VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    version BIGINT NOT NULL DEFAULT 0,  -- optimistic locking
    CONSTRAINT uq_applications_name UNIQUE (name)
);

CREATE INDEX idx_applications_name ON applications(name);
CREATE INDEX idx_applications_owner ON applications(owner);
```

### 11.4 Type Rules

| Data | PostgreSQL Type |
|------|----------------|
| Primary key | `UUID` |
| Money | `NUMERIC(19,4)` |
| Timestamps | `TIMESTAMP WITH TIME ZONE` |
| Text (bounded) | `VARCHAR(n)` |
| Text (unbounded) | `TEXT` |
| Boolean | `BOOLEAN` |
| Large content (contracts) | `TEXT` or `JSONB` |

### 11.5 Index Rules

- **ALWAYS** index foreign keys
- **ALWAYS** index common WHERE/ORDER BY columns
- **CONSIDER** partial indexes for status filters

### 11.6 Migration Immutability (CRITICAL)

Once deployed to any environment: NEVER modify. Create a new migration instead.

### 11.7 Backward Compatibility (CRITICAL)

Migrations must work with both old and new application versions:

```sql
-- Step 1 (v2): Add new column
ALTER TABLE applications ADD COLUMN display_name VARCHAR(255);
UPDATE applications SET display_name = name;

-- Step 2 (v3, after all instances updated): Remove old column
ALTER TABLE applications DROP COLUMN legacy_name;
```

### 11.8 Configuration

```yaml
spring:
  flyway:
    enabled: true
    locations: classpath:db/migration
    baseline-on-migrate: true
    validate-on-migrate: true
  datasource:
    url: ${DATABASE_URL:jdbc:postgresql://localhost:5432/broker_dev}
```

### 11.9 Test Migrations with Testcontainers (REQUIRED)

Repository slice tests (`@DataJpaTest`) with Testcontainers PostgreSQL validate that
all Flyway migrations apply cleanly against real PostgreSQL.

---

## 12. Observability

### 12.1 Mandatory Dependencies

```xml
<dependency>micrometer-core</dependency>
<dependency>micrometer-observation</dependency>
<dependency>context-propagation</dependency>  <!-- CRITICAL for async -->
```

### 12.2 Context Propagation (CRITICAL)

Ensures trace/span IDs propagate across thread boundaries.
Auto-instruments `@Async`, `CompletableFuture`, `Executor`.

### 12.3 Business Metrics (REQUIRED)

Every business-critical flow MUST have metrics:

```java
registry.counter("broker.applications.registered", "status", "success").increment();
registry.counter("broker.contracts.published").increment();
registry.counter("broker.verifications.recorded", "result", result.name()).increment();
registry.counter("broker.can_i_deploy.queries", "result", ok ? "safe" : "unsafe").increment();
registry.timer("broker.ai.contract_generation.time").record(duration);
```

### 12.4 Log Correlation (REQUIRED)

```yaml
logging:
  pattern:
    console: "%d{yyyy-MM-dd HH:mm:ss} [%X{traceId}/%X{spanId}] %-5level %logger{36} - %msg%n"
```

### 12.5 Health Probes (REQUIRED)

```yaml
management:
  endpoint:
    health:
      probes:
        enabled: true
  health:
    livenessState:
      enabled: true
    readinessState:
      enabled: true
```

### 12.6 Custom Health Indicators (RECOMMENDED)

For external dependencies like the LLM API:

```java
@Component
class LlmHealthIndicator implements HealthIndicator {
    @Override
    public Health health() {
        // Check LLM API reachability
    }
}
```

### 12.7 Spring-Managed Executors Only (CRITICAL)

```java
// ALWAYS
@Autowired Executor taskExecutor;
CompletableFuture.runAsync(() -> process(), taskExecutor);

// NEVER (loses trace context)
CompletableFuture.runAsync(() -> process());
Executors.newFixedThreadPool(10);
```

---

## 13. Controller Rules

### 13.1 Thin Layer Only (CRITICAL)

Controllers MUST ONLY:
1. Accept HTTP request
2. Call a single service method
3. Convert result to HTTP response

Controllers MUST NOT contain:
- Business logic
- Multiple service calls
- Conditional business rules
- Data transformation beyond `Response.from(domain)`

### 13.2 No Static Security Context (CRITICAL)

```java
// GOOD — injected
@GetMapping
ResponseEntity<List<ApplicationResponse>> list(
        @AuthenticationPrincipal Jwt jwt) { }

// BAD — static (NEVER)
SecurityContextHolder.getContext().getAuthentication();
```

### 13.3 Response Mapping (REQUIRED)

Use static factory methods:
```java
record ApplicationResponse(UUID id, String name, String description, ...) {
    static ApplicationResponse from(Application app) {
        return new ApplicationResponse(app.getId(), app.getName(), ...);
    }
}
```

---

## 14. Code Style

### 14.1 REQUIRED

| Rule | Detail |
|------|--------|
| Use imports, not FQNs | `import x.y.Z;` not `x.y.Z z = ...` |
| Remove unused code | Delete it — VCS preserves history |
| Remove unused imports | Run `./mvnw spring-javaformat:apply` |
| Meaningful names | `applicationName` not `s` |
| Fail fast | Validate inputs at method entry |
| KISS | Simplest solution wins |
| YAGNI | Don't build what you don't need |
| DRY | Extract at 3+ occurrences |

### 14.2 SUGGESTED

| Rule | Target |
|------|--------|
| Short methods | ~10-15 lines |
| Short classes | ~100-200 lines |
| Compact methods | Minimal blank lines |
| Single responsibility | One class = one reason to change |

### 14.3 Spring Java Format

All code formatted with Spring Java Format. Run before every commit:

```bash
./mvnw spring-javaformat:apply
```

### 14.4 Domain Conventions

| Concept | Rule |
|---------|------|
| Money | `BigDecimal`, never `double` |
| IDs | Typed IDs (`ApplicationName`, `VersionId`) — not raw `String`/`UUID` |
| Timestamps | `Instant` for storage, `ZonedDateTime` for display |

---

## 15. Git Workflow

### 15.1 Branch Naming (REQUIRED)

```
<type>/<short-description>

feature/application-registration
feature/contract-publishing
feature/can-i-deploy
feature/security-rbac
feature/ai-traffic-proxy
bugfix/fix-contract-validation
refactor/extract-safety-service
```

Types: `feature/`, `bugfix/`, `hotfix/`, `refactor/`, `docs/`, `test/`

### 15.2 Commit Messages (REQUIRED)

```
<type>: <short summary under 72 chars>

<optional body>

<optional footer>
```

Types: `feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`

Example:
```
feat: Add application registration endpoint

Implements CRUD for applications with name validation,
unique constraint, and contract test stubs.

Spec: docs/specs/001-application-registration.md
```

### 15.3 Atomic Commits (REQUIRED)

One commit = one logical change. Tests must pass before commit.

### 15.4 PR Rules

- Size: < 400 lines (max 800, split if larger)
- Template with Summary, Changes, Spec link, Testing checklist
- Delete branch after merge

---

## 16. Feature Specifications

Each feature has a spec at `docs/specs/NNN-feature-name.md` with:
- What the feature does
- Who uses it
- Business rules
- Success and error cases
- Given/When/Then acceptance criteria

### Feature Specs Required

| # | Feature | Spec File |
|---|---------|-----------|
| 1 | Application Registration | `docs/specs/001-application-registration.md` |
| 2 | Contract/Stub Publishing | `docs/specs/002-contract-publishing.md` |
| 3 | Verification Results | `docs/specs/003-verification-results.md` |
| 4 | Environment Tracking | `docs/specs/004-environment-tracking.md` |
| 5 | Can I Deploy | `docs/specs/005-can-i-deploy.md` |
| 6 | Security (RBAC, Auth, Audit) | `docs/specs/006-security.md` |
| 7 | AI Traffic-to-Contract Proxy | `docs/specs/007-ai-traffic-proxy.md` |

---

## 17. Feature Build Order

Features are built sequentially. Each must pass ALL validation steps before proceeding.

| # | Feature | Key Tests |
|---|---------|-----------|
| 0 | **Project Setup** | pom.xml, static analysis, empty app boots, Flyway + Testcontainers |
| 1 | **Application Registration** | Unit+Param, Property, Repo(TC), Controller Slice, Contract+RestDocs, E2E, Mutation |
| 2 | **Contract/Stub Publishing** | Unit+Param, Property(roundtrip), Repo(TC), Slice, Contract, Mutation |
| 3 | **Verification Results** | Unit+Param, Property(idempotency), Repo(TC), Slice, Contract, Mutation |
| 4 | **Environment Tracking** | Unit+Param, Property(at-most-one), Repo(TC), Slice, Contract, Mutation |
| 5 | **Can I Deploy** | Unit+Param, Property(determinism), Service, Slice, Contract, E2E, Mutation |
| 6 | **Security** | Security matrix(parameterized), Property(no-unauth), E2E auth, Mutation |
| 7 | **AI Traffic Proxy** | Unit+Param, Property(redaction,matchers), Client(WireMock), E2E proxy, Mutation |

---

## 18. Feature 7: AI Traffic-to-Contract Proxy

### 18.1 Architecture

```
Consumer -> SCC Broker Proxy -> Producer
               |
    1. Capture req/res
    2. Redact secrets (Authorization, Cookie, Set-Cookie, X-API-Key)
    3. Send to LLM (OpenAI-compatible /v1/chat/completions)
    4. Parse YAML
    5. Validate vs OpenAPI spec (swagger-request-validator)
    6. If invalid -> retry with error feedback (max 3)
    7. Apply dynamic matchers
    8. Store in broker
```

### 18.2 Requirements

| ID | Requirement |
|----|-------------|
| REQ-007-1 | HTTP reverse proxy, configurable target URL, OpenAPI spec, LLM endpoint |
| REQ-007-2 | Capture every req/res; REDACT sensitive headers |
| REQ-007-3 | LLM: OpenAI-compatible API, configurable model/temperature/max_tokens |
| REQ-007-4 | Dynamic matchers: UUIDs, timestamps, IDs, emails -> regex/anyNumber |
| REQ-007-5 | OpenAPI validation (path, method, content-type, status, schema) |
| REQ-007-6 | Retry: errors fed back to LLM, max 3 retries, then "unresolved" |
| REQ-007-7 | Bulk mode: accept HAR file or req/res list via API |
| REQ-007-8 | Deduplication: skip semantically equivalent contracts |
| REQ-007-9 | LLM API key from env var only, NEVER in config files |

### 18.3 AI Module Test Strategy (HEAVIEST TESTING)

Non-deterministic AI output requires maximum guardrails.

**Unit tests (parameterized):**
- `TrafficCaptureFilterTest` — GET/POST/PUT/DELETE, JSON/XML/binary/empty, large bodies
- `HeaderRedactionTest` — each sensitive header redacted, each safe preserved
- `DynamicMatcherReplacerTest` — UUID, timestamp, email, nested JSON, arrays
- `LlmPromptBuilderTest` — prompt construction
- `OpenApiContractValidatorTest` — valid passes, wrong-path/method/schema/status fails

**Property tests (jqwik):**
- Redaction preserves non-sensitive headers
- Dynamic matcher replaces ALL UUIDs
- Retry count never exceeds max
- Redaction never leaves secrets

**HTTP client tests (WireMock):**
- Happy path (valid on first try)
- Retry path (invalid then valid -> 2 calls)
- Max retry (all 3 invalid -> stored as unresolved)
- LLM timeout, 500, non-YAML responses

**E2E proxy test:**
Real HTTP through proxy -> target (WireMock) -> assert contract generated, validated, stored.

### 18.4 LLM Prompt (version-controlled in `src/main/resources/prompts/`)

The prompt instructs the LLM on dynamic matchers:
- UUIDs -> `regex('[a-f0-9]{8}-...')`
- Timestamps -> `regex('\\d{4}-\\d{2}-...')`
- Numeric IDs -> `anyNumber()`
- Emails -> `regex('.+@.+\\..+')`
- Hardcode ONLY: enums, booleans, domain constants

---

## 19. Validation Checklist — After Every Feature

```bash
# 1. Format
./mvnw spring-javaformat:apply

# 2. Fast tests + static analysis (all 5 tools)
./mvnw clean verify

# 3. Integration + E2E tests (needs Docker)
./mvnw failsafe:integration-test failsafe:verify

# 4. Mutation testing
./mvnw org.pitest:pitest-maven:mutationCoverage
# -> target/pit-reports/index.html must show >= 80%

# 5. Stubs JAR produced (eat-own-dogfood)
ls target/*-stubs.jar

# 6. Security checklist reviewed (Section 10.8)
```

ALL steps must pass. No exceptions. No "I'll fix it later."

---

## 20. Anti-Patterns

| # | Anti-Pattern | Caught By |
|---|-------------|-----------|
| 1 | Tests without assertions | PITest |
| 2 | Tests that test the mock | Code review |
| 3 | Production code before tests | Workflow discipline |
| 4 | Copy-paste test methods | Use `@ParameterizedTest` |
| 5 | Skipping property tests | Workflow discipline |
| 6 | Weak properties (`assertNotNull`) | PITest + review |
| 7 | Not running mutation testing | Workflow step 4 |
| 8 | Full `@SpringBootTest` when slice suffices | Performance review |
| 9 | Testcontainers in unit tests | TC is for repo/E2E only |
| 10 | Catching exceptions to pass tests | SpotBugs |
| 11 | Suppressing static analysis | Review policy |
| 12 | Missing security tests | Security matrix |
| 13 | Trusting LLM output | OpenAPI validation |
| 14 | Hardcoded volatile values | Dynamic matchers |
| 15 | Swallowing exceptions | SpotBugs + error-handling rules |
| 16 | Catching generic `Exception` | Error-handling rules |
| 17 | Business logic in controllers | Controller rules |
| 18 | Static SecurityContext in controllers | ArchUnit test |
| 19 | Unbounded caches/queues | SpotBugs + java-spring rules |
| 20 | H2 for PostgreSQL-targeted code | Testing rules |

---

## 21. Learnings & Knowledge Base

### 21.1 Record Key Findings (REQUIRED)

When you discover something significant during a task, record in `spec/learnings/`:
- Unexpected behavior or gotchas
- Non-obvious dependencies
- Performance characteristics
- Security constraints
- Integration quirks
- Debugging breakthroughs

**Rule of thumb:** Would this save someone 15+ minutes next time? Record it.

### 21.2 File Format

```
spec/learnings/<category>-<topic>.md

Categories: architecture, dependencies, infrastructure, testing,
            performance, security, integrations, debugging
```

### 21.3 Update Index

After creating/removing a learning, update `spec/learnings/README.md`.

### 21.4 Check Before Starting

Scan `spec/learnings/` before starting any task to apply existing knowledge.

---

## 22. Exception & Override Policy

### 22.1 User Override

When user explicitly says "skip X":
- Honor the override (current task only)
- Document what was skipped
- Recommend completing later
- Agent MUST NOT suggest skipping

### 22.2 External Constraints

When libraries/APIs force deviation:
- Document the constraint
- Isolate in adapter pattern
- Don't let it leak into domain code

### 22.3 What's NEVER Excepted

Even in hotfixes:
- No sensitive data in logs
- Bounded caches/queues
- No hardcoded secrets
- Tests must actually run

### 22.4 Decision Tree

```
Is user explicitly overriding?
├── YES -> Honor, document, recommend follow-up
└── NO  -> Is there an external constraint?
            ├── YES -> Document, isolate, proceed
            └── NO  -> Follow the rules
```

---

## 23. Resolved Conflicts Between Rule Sources

| Conflict | Build Prompt Says | Local Rules Say | Resolution |
|----------|-------------------|-----------------|------------|
| Java version | Java 17 | Java 21 | **Java 17** (build prompt is project-specific) |
| Spec location | `docs/specs/NNN-*.md` | `spec/features/` | **Both**: specs in `docs/specs/`, learnings in `spec/learnings/`, contracts in `spec/contracts/` |
| Test naming | Various patterns | `should_X_when_Y` | **Merge**: use `should_X_when_Y` pattern from local rules, with parameterized approach from build prompt |
| SpringBoot version | 4.0.2 | 4.x | **4.0.2** (build prompt is specific) |
| Observability | Not mentioned | Detailed requirements | **Include**: add micrometer/observation/context-propagation per local rules |
| Error handling | Minimal mention | Detailed hierarchy | **Include**: full error handling per local rules |
| API design | Endpoint examples only | Full API design rules | **Include**: full API design rules (versioning, pagination, etc.) |
| Controller rules | Not mentioned | Detailed thin-layer rules | **Include**: controllers as thin layers, no static security context |
| Git workflow | Not mentioned | Full branch/commit/PR rules | **Include**: full git workflow rules |
| Database types | PostgreSQL 16-alpine | UUID, NUMERIC, etc. | **Merge**: PostgreSQL 16-alpine + all type rules |
| Audit/observability | Audit log requirement | Full observability | **Merge**: audit log + metrics + tracing + health probes |

---

*This plan is the single source of truth for building Stubborn.
Every rule from both the build prompt and local Claude rules has been incorporated.*
