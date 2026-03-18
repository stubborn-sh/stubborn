# Testing Coverage Requirements

**Category:** Testing
**Last Updated:** 2026-02-28

## Related Files

- All feature modules under `broker/src/test/java/`
- `ui/tests/unit/` (Vitest)
- `e2e-tests/src/test/java/` (Playwright)
- `samples/` (integration samples)

## Findings

### Every feature MUST have tests at all layers

**Discovered:** 2026-02-28
**Evidence:** User feedback — dependency graph feature shipped without frontend unit tests, Playwright E2E test, or sample coverage.

Every new feature must include:

| Layer | What | Tool | Location |
|-------|------|------|----------|
| **Backend unit** | Service logic, edge cases | JUnit + AssertJ | `broker/src/test/.../feature/` |
| **Backend contract** | MockMvc + RestDocs stubs | @WebMvcTest, @Tag("generate-stubs") | `broker/src/test/.../feature/` |
| **Backend integration** | Full stack with DB | Failsafe + Testcontainers | `broker/src/test/.../feature/` |
| **Frontend unit** | Component rendering, interactions | Vitest + MSW + React Testing Library | `ui/tests/unit/feature/` |
| **Browser E2E** | Critical user paths only | Playwright + Testcontainers | `e2e-tests/` |
| **Samples** | Real-world usage demonstration | Sample apps | `samples/` |

### E2E tests are critical paths only

E2E (Playwright) tests are expensive — they start Docker containers and a real browser. They should cover:

- **Happy path navigation** — page loads, data visible
- **Critical user workflows** — e.g., register app → publish contract → verify → check deploy safety
- **Cross-feature interactions** — e.g., graph page showing data from verifications

E2E tests should NOT cover:
- Edge cases (that's what unit tests are for)
- Error handling variations
- Exhaustive input validation
- Search/filter permutations

### Checklist before a feature is "done"

- [ ] Backend unit tests (service + edge cases)
- [ ] Backend contract tests (stubs generation)
- [ ] Backend E2E tests (Failsafe, full stack)
- [ ] Frontend unit tests (Vitest, MSW mocks)
- [ ] Playwright E2E (critical path only)
- [ ] MSW handlers added for new API endpoints
- [ ] Sample demonstrates the feature (if applicable)

## Change Log

| Date | Change |
|------|--------|
| 2026-02-28 | Initial: every feature needs full test coverage, E2E = critical paths only |
