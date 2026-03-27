# Feature 28: High Availability

## What

The broker supports running multiple instances concurrently behind a load balancer,
all sharing the same PostgreSQL database. Any instance can serve any request — there
are no sticky sessions, no in-memory state coordination, and no cluster membership
protocol.

## Why

Production deployments need:
- Zero-downtime rolling deployments
- Horizontal scalability under load
- Resilience to individual instance failures
- No single point of failure at the application layer

## How (High Level)

The broker is stateless by design. All persistent state (applications, contracts,
verifications, deployments, webhooks) is stored in PostgreSQL. Concurrent write
safety is enforced by database uniqueness constraints — duplicate contract publishes
from different instances result in either idempotent success or 409 Conflict.

No additional configuration is needed for HA. Just run N instances pointed at the
same database behind any load balancer (nginx, Kubernetes Service, AWS ALB, etc.).

## Business Rules

1. Data written to any instance is immediately visible from all other instances
2. Duplicate contract publishes from concurrent instances must not create duplicates
   (enforced by unique constraint on application_id + version + contract_name)
3. Instance failure must not affect other instances' ability to serve reads and writes
4. Deployment safety checks (`can-i-deploy`) must see deployments recorded on any instance
5. The database is the single point of failure — use PostgreSQL HA for full resilience

## Acceptance Criteria

### Data Replication

**Given** two broker instances (A and B) sharing the same PostgreSQL
**When** I register application "ha-test-producer" on instance A
**Then** GET `/api/v1/applications` on instance B returns "ha-test-producer"

### Contract Consistency

**Given** application "ha-test-producer" exists
**When** I publish contract "get-order" to instance A
**Then** GET contracts from instance B returns "get-order"

### Concurrent Write Safety

**Given** both instances receive the same contract POST simultaneously
**Then** exactly one copy of the contract exists in the database
**And** both responses are either 200/201 (idempotent) or 409 (conflict)

### Instance Failure Resilience

**Given** instance A is stopped
**When** I POST a verification to instance B
**And** instance A is restarted
**Then** GET verifications from instance A returns the verification written by B

### Cross-Instance Deployment Safety

**Given** a deployment is recorded on instance A
**When** I check `can-i-deploy` on instance B
**Then** the safety check sees the deployment from instance A

## Error Cases

| Scenario | Expected |
|----------|----------|
| All instances down, DB up | No requests served; DB retains all data |
| DB down, instances up | Circuit breaker opens, instances return 503 |
| Network partition (instance can't reach DB) | Circuit breaker opens for that instance |

## E2E Test

`HighAvailabilityE2ETest` — Testcontainers-based test spinning up 2 broker instances
against 1 PostgreSQL. Exercises all 5 acceptance criteria above.

See: `e2e-tests/src/test/java/sh/stubborn/oss/e2e/HighAvailabilityE2ETest.java`
