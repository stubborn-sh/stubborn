# 028 — High Availability

## Status: Accepted

## Context

Production deployments of the Stubborn broker need to support high availability (HA) —
multiple broker instances sharing the same PostgreSQL database. This ensures zero-downtime
deployments, horizontal scalability, and resilience to individual instance failures.

## Decision

The broker is stateless by design: all persistent state lives in PostgreSQL. Any number of
broker instances can connect to the same database and serve traffic concurrently. There is
no in-memory cache that would require invalidation or coordination between instances.

### Key properties

1. **Data replication** — An application registered on instance A is immediately visible
   from instance B (they share the same database).
2. **Contract consistency** — Contracts published on one instance are readable from any
   other instance.
3. **Concurrent write safety** — Duplicate contract publishes from different instances are
   handled via database uniqueness constraints (idempotent success or 409 Conflict).
4. **Instance failure resilience** — If one instance goes down, all remaining instances
   continue to serve reads and writes. When the failed instance restarts, it sees all data
   written while it was down.
5. **Cross-instance deployment safety** — `can-i-deploy` checks on one instance see
   deployments recorded on any other instance.

## E2E Test

`HighAvailabilityE2ETest` spins up two broker containers against a single PostgreSQL using
Testcontainers and exercises all five properties above:

1. `should_replicate_data_across_instances` — POST app to A, GET from B
2. `should_publish_contracts_on_one_and_read_on_other` — POST contract to A, GET from B
3. `should_handle_concurrent_duplicate_publish` — simultaneous POST to A and B
4. `should_survive_instance_failure` — stop A, write to B, restart A, read from A
5. `should_deployment_safety_work_across_instances` — deploy on A, can-i-deploy on B

## Consequences

- Operators can run N broker instances behind a load balancer for HA.
- No sticky sessions or session affinity required.
- Database becomes the single point of failure — use PostgreSQL HA (e.g., Patroni, RDS
  Multi-AZ) for full production resilience.
