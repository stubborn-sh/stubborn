# ADR 0004: PostgreSQL with Flyway Migrations

## Status

Accepted

## Context

The broker needs persistent storage for applications, contracts, verification results,
and environment deployments. Schema changes must be versioned and reproducible.

## Decision

Use **PostgreSQL 16** as the primary database with **Flyway** for schema migrations.

- `ddl-auto: validate` — Hibernate never modifies schema
- All changes via `V<n>__description.sql` migrations
- Testcontainers PostgreSQL for integration tests (no H2)
- Docker Compose auto-provisions PostgreSQL in dev mode

## Consequences

- **Positive**: Schema changes are versioned, auditable, and reproducible
- **Positive**: Tests run against real PostgreSQL (no H2 dialect differences)
- **Positive**: Flyway baseline-on-migrate supports adopting existing databases
- **Negative**: Requires Docker for integration tests
- **Negative**: Migrations are immutable once deployed
