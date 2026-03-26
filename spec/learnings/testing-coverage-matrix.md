# Testing Coverage Matrix

**Category:** Testing
**Last Updated:** 2026-03-02

## Related Files

- `broker/src/test/java/` (Surefire + Failsafe)
- `broker/src/test/java/.../security/SecurityRbacTest.java` (RBAC unit test)
- `ui/tests/unit/` (Vitest + MSW)
- `e2e-tests/src/test/java/` (Playwright E2E)
- `proxy/src/test/java/` (Proxy unit + WireMock integration)

## Findings

### Comprehensive audit of test coverage across all features

**Discovered:** 2026-03-02
**Evidence:** Systematic review of all feature modules, test directories, and UI test files.

| Feature | E2E (Playwright) | UI (Vitest+MSW) | API (Controller) | Service | Error Handling |
|---------|:-:|:-:|:-:|:-:|:-:|
| Applications | Y | Y | Y | Y | Y (UI + API) |
| Contracts | Y | Y | Y | Y | Y (UI + API) |
| Verifications | Y | Y | Y | Y | Y (UI + API) |
| Environments | Y | Y | Y | Y | Y (UI + API) |
| Can I Deploy | Y | Y | Y | Y | Y (UI + API) |
| Graph | Y | Y | Y | Y | Y (UI + API) |
| Webhooks | Y | Y | Y | Y | Y (UI + API) |
| Matrix | Y | Y | Y | Y | Y (UI + API) |
| Tags | Y | Y | Y | Y | Y (UI + API) |
| Cleanup | Y | Y | Y | Y | Y (UI + API) |
| Selectors | Y | N/A (no UI) | Y | Y | N/A |
| Security | Y | N/A | Y (contract) | Y | Y (RBAC unit) |
| Dashboard | Y | Y | N/A (aggregation) | N/A | Y (UI) |
| AI Proxy | Y | N/A | Y | Y | Y (WireMock) |

### Test counts by module (as of 2026-03-02)

| Module | Surefire | Failsafe | Vitest | Playwright |
|--------|----------|----------|--------|------------|
| broker | ~316 | ~90 | - | - |
| proxy | ~20 | - | - | - |
| broker-mcp-server | 71 | - | - | - |
| ui | - | - | 163 | - |
| e2e-tests | - | - | - | 9 |

### Gaps filled in this audit

1. **Security RBAC unit test** (`SecurityRbacTest.java`) — 13 tests verifying READER/PUBLISHER/ADMIN role access patterns using `@WebMvcTest` + `httpBasic()` (no Docker needed)
2. **UI error handling** — Added error states to ContractsPage and EnvironmentsPage (were missing `error` destructuring and rendering)
3. **Dashboard error test** — Added test verifying "Failed to load dashboard data" on API failure
4. **Contracts fallback test** — Added test verifying graceful degradation when applications API fails
5. **Applications error test** — Added test verifying "Failed to load applications" on API failure
6. **Proxy WireMock integration test** (`ContractGenerationWireMockTest.java`) — 5 tests verifying real ChatClient → WireMock OpenAI flow (no `@MockitoBean`)

### Key testing patterns discovered

- **RBAC testing without Docker**: Use `@WebMvcTest` (all controllers, since they're package-private) + `@Import({ SecurityConfig.class, UserConfig.class })` + `httpBasic("user", "pass")` post-processor. `@WithMockUser` does NOT work with custom `SecurityConfig` using `httpBasic()`.
- **UI error testing pattern**: Override MSW handlers with `server.use(http.get(..., () => HttpResponse.json({}, { status: 500 })))`, then assert error message appears.
- **WireMock OpenAI mocking**: Stub `POST /v1/chat/completions` returning standard chat completion JSON. Use `@DynamicPropertySource` to set `spring.ai.openai.base-url` to WireMock URL. No `@MockitoBean` needed.
- **"Allowed" vs "Denied" assertions in RBAC**: For "allowed" tests with mocked services, check `status.isNotIn(401, 403)` (mock services may return 500/204 defaults). For "denied" tests, check `status().isForbidden()`.

## Change Log

| Date | Change |
|------|--------|
| 2026-03-02 | Initial: comprehensive coverage audit across all features |
