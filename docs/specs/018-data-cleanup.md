# Feature 18: Data Cleanup

## What

Data cleanup removes old contract versions and their associated verifications while
protecting deployed versions, tagged versions, and the most recent N versions. The
cleanup is triggered via an admin-only API endpoint and applies configurable retention
policies to prevent unbounded data growth.

## Why

Without data cleanup, teams cannot:
- Prevent the database from growing indefinitely as new versions are published
- Remove obsolete contract versions that are no longer relevant
- Maintain broker performance as the volume of historical data increases
- Apply retention policies that balance data preservation with storage constraints

Data cleanup is essential for long-running broker deployments where hundreds of versions
accumulate over time.

## How (High Level)

An ADMIN-authenticated user triggers cleanup via a POST endpoint with a retention policy.
The broker evaluates each application's versions against the policy, identifying versions
eligible for deletion. Versions that are currently deployed to protected environments,
have tags, or fall within the "keep latest N" threshold are exempt. Eligible versions
and their contracts and verifications are deleted. The response reports what was removed.

## API

```
POST /api/v1/maintenance/cleanup    -> 200 OK (cleanup report)
```

### Request: Cleanup

```json
{
    "keepLatest": 10,
    "protectedEnvironments": ["production", "staging"],
    "dryRun": false
}
```

### Response: Cleanup Report

```json
{
    "dryRun": false,
    "applicationsProcessed": 5,
    "versionsDeleted": 23,
    "contractsDeleted": 89,
    "verificationsDeleted": 156,
    "protectedVersions": [
        {
            "applicationName": "order-service",
            "version": "1.2.0",
            "reason": "deployed to production"
        },
        {
            "applicationName": "order-service",
            "version": "1.0.0",
            "reason": "tagged: RELEASE"
        }
    ],
    "deletedVersions": [
        {
            "applicationName": "order-service",
            "version": "0.1.0",
            "contractsDeleted": 3,
            "verificationsDeleted": 5
        }
    ],
    "executedAt": "2026-01-15T10:30:00Z"
}
```

## Business Rules

1. Only users with ADMIN role can trigger cleanup
2. The `keepLatest` field specifies the minimum number of most recent versions to retain per application (default: 10, minimum: 1)
3. Versions currently deployed to any environment listed in `protectedEnvironments` are never deleted
4. Versions with any tags (see Feature 17) are never deleted regardless of age or position
5. The latest N versions (by creation timestamp) per application are never deleted, where N is `keepLatest`
6. When `dryRun` is true, the broker calculates what would be deleted but performs no actual deletions
7. Deleting a version cascades to its contracts, verifications, and any associated metadata
8. Cleanup processes one application at a time to avoid long-running transactions
9. The response includes both protected versions (with reasons) and deleted versions (with counts)
10. If no versions are eligible for deletion, the cleanup succeeds with zero deletions
11. Cleanup does not delete applications themselves, only their old versions
12. The `protectedEnvironments` field is optional; when omitted, no environment-based protection is applied (only tags and keepLatest protect versions)

## Acceptance Criteria

### Basic Cleanup

**Given** "order-service" has versions 0.1.0 through 0.15.0 (15 versions)
**And** no versions are deployed or tagged
**When** I POST `/api/v1/maintenance/cleanup` with `keepLatest: 10`
**Then** I receive 200 OK
**And** versions 0.1.0 through 0.5.0 are deleted (oldest 5)
**And** versions 0.6.0 through 0.15.0 are retained

### Protect Deployed Versions

**Given** "order-service" has versions 0.1.0 through 0.15.0
**And** version 0.2.0 is deployed to "production"
**When** I POST `/api/v1/maintenance/cleanup` with `keepLatest: 10` and `protectedEnvironments: ["production"]`
**Then** version 0.2.0 is NOT deleted
**And** version 0.2.0 appears in `protectedVersions` with reason "deployed to production"

### Protect Tagged Versions

**Given** "order-service" has versions 0.1.0 through 0.15.0
**And** version 0.3.0 has tag "RELEASE"
**When** I POST `/api/v1/maintenance/cleanup` with `keepLatest: 10`
**Then** version 0.3.0 is NOT deleted
**And** version 0.3.0 appears in `protectedVersions` with reason "tagged: RELEASE"

### Dry Run

**Given** "order-service" has versions eligible for deletion
**When** I POST `/api/v1/maintenance/cleanup` with `dryRun: true`
**Then** I receive 200 OK
**And** the response shows what would be deleted
**And** no data is actually removed
**And** `dryRun` is true in the response

### Cascade Delete

**Given** "order-service" version "0.1.0" has 3 contracts and 5 verifications
**And** version "0.1.0" is eligible for deletion
**When** I POST `/api/v1/maintenance/cleanup` with `keepLatest: 10`
**Then** version "0.1.0" is deleted
**And** its 3 contracts are deleted
**And** its 5 verifications are deleted
**And** the response reports `contractsDeleted: 3` and `verificationsDeleted: 5` for this version

### No Eligible Versions

**Given** "order-service" has only 5 versions
**When** I POST `/api/v1/maintenance/cleanup` with `keepLatest: 10`
**Then** I receive 200 OK
**And** `versionsDeleted` is 0

### Unauthorized Access

**Given** I am authenticated as a READER
**When** I POST `/api/v1/maintenance/cleanup`
**Then** I receive 403 Forbidden

## Error Cases

| Scenario | HTTP Status | Error Code |
|----------|-------------|------------|
| Unauthorized (not ADMIN) | 403 | FORBIDDEN |
| keepLatest less than 1 | 400 | VALIDATION_ERROR |
| Invalid environment name | 400 | VALIDATION_ERROR |
