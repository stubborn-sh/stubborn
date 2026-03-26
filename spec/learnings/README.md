# Learnings

Key findings about the codebase, accumulated during development.

| Topic | File | Last Updated | Summary |
|-------|------|--------------|---------|
| SB4 Tracing Test Starters | [testing-spring-boot-4-tracing.md](testing-spring-boot-4-tracing.md) | 2026-02-26 | NEVER mock Tracer — use `spring-boot-micrometer-tracing-test` + `@AutoConfigureTracing` |
| SB4 Migrations | [dependencies-spring-boot-4-migrations.md](dependencies-spring-boot-4-migrations.md) | 2026-03-01 | Package moves, renamed starters, deprecated TestRestTemplate, aspectj rename, **Jackson 3 (ObjectMapper→JsonMapper)**, **RestClient.Builder needs spring-boot-restclient** |
| Spring AI 2.0.0-M2 | [dependencies-spring-ai-2.md](dependencies-spring-ai-2.md) | 2026-03-01 | Artifact rename + MCP annotations in `org.springaicommunity.mcp.annotation` (NOT `org.springframework.ai`) |
| Cross-Package Patterns | [architecture-cross-package.md](architecture-cross-package.md) | 2026-02-27 | Public services + DTO records for cross-feature access, E2E test isolation |
| Transactional Services | [architecture-transactional.md](architecture-transactional.md) | 2026-02-28 | Only `@Transactional` on write methods; repos are transactional by default |
| Stub Runner Requirement | [testing-stub-runner-requirement.md](testing-stub-runner-requirement.md) | 2026-02-28 | Broker stubs via Stub Runner only — no manual WireMock (except transport errors) |
| Test Coverage Requirements | [testing-coverage-requirements.md](testing-coverage-requirements.md) | 2026-02-28 | Every feature needs all test layers; E2E = critical paths only |
| Test Coverage Matrix | [testing-coverage-matrix.md](testing-coverage-matrix.md) | 2026-03-02 | Full audit: all features covered at all layers; RBAC unit test + UI error handling patterns |
| Observability in SB4 | [observability-spring-boot-4.md](observability-spring-boot-4.md) | 2026-03-01 | @Observed pattern, BrokerGauges, testing strategies, Boot 4 dependency changes |
| JS/TS SDK | [javascript-typescript-sdk.md](javascript-typescript-sdk.md) | 2026-03-13 | Package architecture, cross-language contracts, stub-server vs WireMock, build integration |
