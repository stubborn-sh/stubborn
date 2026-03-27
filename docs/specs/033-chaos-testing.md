# Spec 033 — Chaos Testing

## Summary

Chaos/resilience E2E tests that prove the broker's Resilience4j circuit breakers work
correctly under failure conditions. Two scenarios are covered:

1. **Database failure** (Postgres pause/unpause) — the `database` circuit breaker opens
   after repeated failures, returning 503 to clients, then recovers when the database
   comes back.
2. **Webhook timeout** — the `webhookDispatch` circuit breaker opens after repeated
   slow/failing webhook deliveries, recording "circuit breaker open" execution entries.

## Circuit Breaker Configuration (from application.yaml)

| Parameter                          | Value |
|------------------------------------|-------|
| sliding-window-size                | 10    |
| minimum-number-of-calls            | 5     |
| failure-rate-threshold             | 50%   |
| wait-duration-in-open-state        | 30s   |
| permitted-calls-in-half-open-state | 3     |
| auto-transition-open-to-half-open  | true  |

## Scenario A — ChaosPostgresE2ETest

### Steps

1. Start PostgreSQL + broker via Testcontainers (own containers, not SharedContainers).
2. Verify healthy state: `GET /api/v1/applications` returns 200.
3. **Pause** the PostgreSQL container via Docker API.
4. Make requests that hit the database — they should fail (500).
5. After 5+ failures the `database` circuit breaker opens: subsequent calls return 503
   (`SERVICE_UNAVAILABLE`).
6. **Unpause** PostgreSQL.
7. Wait for circuit breaker half-open transition (~30s).
8. Make a request — should succeed (200), proving recovery.

### Acceptance Criteria

- [x] Healthy request succeeds before fault injection.
- [x] Requests fail with 500 while database is paused.
- [x] After enough failures, requests return 503 (circuit open).
- [x] After database recovery and half-open wait, requests succeed again.

## Scenario B — ChaosWebhookE2ETest

### Steps

1. Start PostgreSQL + broker + WireMock container.
2. Register a webhook pointing to WireMock configured with a 30-second delay.
3. Publish contracts to trigger webhook dispatches (each times out at 15s read timeout).
4. After enough failed dispatches, the `webhookDispatch` circuit breaker opens.
5. Verify via webhook executions API that a "circuit breaker open" entry is recorded.

### Acceptance Criteria

- [x] Webhook dispatch attempts time out against slow WireMock.
- [x] Circuit breaker opens after threshold is met.
- [x] Fallback records "circuit breaker open" execution entry.

## Tags

All chaos tests use `@Tag("chaos")` so they can be included/excluded independently.
