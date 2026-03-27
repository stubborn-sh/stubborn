# Feature 31: Flyway Migration Integrity

## What

An E2E test that proves all Flyway migrations (V1 through V12) apply cleanly to a
bare PostgreSQL database and that basic CRUD operations work on the resulting schema.

## Why

Database migrations are the foundation of the broker's persistence layer. A broken or
out-of-order migration silently corrupts production deployments. This test catches:
- Migrations that fail on a clean database (e.g., missing dependency, syntax error)
- Missing tables or columns that the broker API depends on
- Schema drift between what migrations create and what the application expects

The test runs against a real PostgreSQL instance via Testcontainers, not H2 or an
embedded database, ensuring PostgreSQL-specific syntax (e.g., `gen_random_uuid()`,
`JSONB`, `TIMESTAMPTZ`) is validated.

## How (High Level)

1. Start a bare PostgreSQL 16 container via Testcontainers
2. Start the broker container pointed at that database (Flyway runs automatically)
3. Wait for the broker to report healthy (`/actuator/health` returns `UP`)
4. Query `information_schema.tables` via the broker's database connection to verify
   all expected tables exist
5. Exercise basic CRUD: register an app, publish a contract, record a verification,
   record a deployment
6. Verify each CRUD response returns a success status code

## Business Rules

1. All migrations V1-V12 must apply without error on a clean PostgreSQL 16 database
2. The broker must start successfully after all migrations complete
3. Every table created by migrations must exist in the resulting schema
4. The broker API must be able to perform basic CRUD operations on the migrated schema

## Acceptance Criteria

### Schema Completeness
- [ ] Table `applications` exists (V1)
- [ ] Table `contracts` exists (V2)
- [ ] Table `verifications` exists (V3)
- [ ] Table `deployments` exists (V4)
- [ ] Table `audit_log` exists (V5)
- [ ] Table `webhooks` exists (V8)
- [ ] Table `webhook_executions` exists (V8)
- [ ] Table `version_tags` exists (V9)
- [ ] Table `environments` exists (V10)
- [ ] Table `maven_import_sources` exists (V11)
- [ ] Flyway history table `flyway_schema_history` exists

### Column Additions (non-table-creating migrations)
- [ ] Column `applications.main_branch` exists (V6)
- [ ] Column `contracts.branch` exists (V6)
- [ ] Column `contracts.content_hash` exists (V7)
- [ ] Column `applications.repository_url` exists (V12)

### CRUD Smoke Test
- [ ] Register an application via `POST /api/v1/applications` -> 200/201
- [ ] Publish a contract via `POST /api/v1/applications/{app}/versions/{v}/contracts` -> 200/201
- [ ] Record a verification via `POST /api/v1/verifications` -> 200/201
- [ ] Create an environment via `POST /api/v1/environments` -> 200/201
- [ ] Record a deployment via `POST /api/v1/environments/{env}/deployments` -> 200/201

### Health Check
- [ ] `GET /actuator/health` returns HTTP 200 with status `UP`
