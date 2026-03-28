# Spec 037 — Audit Logging

## Problem

The broker has an empty `audit_log` table (V5 migration) that nobody writes to. There is no audit trail for user actions — no visibility into who changed what, when, or why.

## Solution

Implement comprehensive audit logging at two levels:

1. **Entity-level auditing (Hibernate Envers)**: Track all changes to domain entities with full revision history
2. **API-level action logging**: Log every mutating API call (POST/PUT/DELETE) with principal, action, resource, and outcome

## Design

### Entity auditing with Hibernate Envers

Add `@Audited` to key entities so Envers automatically tracks INSERT/UPDATE/DELETE revisions in `*_aud` shadow tables with a shared `REVINFO` table.

Audited entities: Application, Contract, Verification, Webhook, GitImportSource, MavenImportSource, Environment, Deployment, VersionTag.

Envers auto-creates `REVINFO` and `*_aud` tables via `spring.jpa.hibernate.ddl-auto=validate` + Flyway migration.

### API action logging

New `api_audit_log` table stores a flat record per mutating API call:

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| timestamp | TIMESTAMPTZ | When the action occurred |
| principal | VARCHAR(255) | Authenticated user |
| action | VARCHAR(32) | CREATE, UPDATE, DELETE, IMPORT, LOGIN, DEPLOY |
| resource_type | VARCHAR(64) | APPLICATION, CONTRACT, VERIFICATION, etc. |
| resource_id | VARCHAR(255) | ID of affected resource |
| request_summary | TEXT | Brief description of the request |
| response_status | INT | HTTP response status code |
| ip_address | VARCHAR(45) | Client IP address |
| trace_id | VARCHAR(64) | Distributed trace ID |

An `AuditInterceptor` (Spring `HandlerInterceptor`) captures POST/PUT/DELETE calls automatically.

### Audit query API

`GET /api/v1/audit` — paginated, filterable by principal, action, resourceType. Requires ADMIN role.

### Package

`sh.stubborn.oss.audit` — new vertical slice containing entity, repository, service, controller, interceptor, enums, and DTOs.

## Acceptance criteria

- [ ] `@Audited` annotation present on Application, Contract, Verification, Webhook, GitImportSource, MavenImportSource, Environment, Deployment, VersionTag
- [ ] Flyway V14 migration creates `api_audit_log` table and Envers `REVINFO` + `*_aud` tables
- [ ] `AuditInterceptor` logs POST/PUT/DELETE calls with principal, resource type, and response status
- [ ] `AuditService.logAction()` persists audit entries
- [ ] `GET /api/v1/audit` returns paginated audit log entries (ADMIN only)
- [ ] Unit tests for AuditService, AuditController, AuditInterceptor

## Cross-references

- `V5__create_audit_log_table.sql` — original empty audit_log table (retained for backward compat)
- `SecurityConfig.java` — role-based access control
- `SpaForwardingConfig.java` — existing WebMvcConfigurer (interceptor registered separately)

@see `AuditService.java`, `AuditInterceptor.java`, `AuditController.java`
