# Feature 16: Compatibility Matrix

## What

The compatibility matrix provides a query endpoint that returns the verification status
between all provider-consumer version pairs. It gives a comprehensive overview of which
versions of which services are compatible with each other, enabling teams to understand
cross-service compatibility at a glance.

## Why

Without a compatibility matrix, teams cannot:
- View a summary of all verification results across all service pairs in one query
- Identify which provider version is compatible with which consumer version
- Detect verification gaps where certain version combinations have never been tested
- Generate compatibility reports for auditing or compliance purposes

The matrix provides the data foundation for dashboards and reports that show the overall
health of the contract testing ecosystem.

## How (High Level)

The matrix endpoint aggregates verification records into a flat list of entries, each
representing a unique provider-consumer version pair. Each entry includes the provider
and consumer details, the verification status, the branch, and the timestamp of the
most recent verification. The results can be filtered by provider name, consumer name,
or both.

## API

```
GET /api/v1/matrix                                          -> 200 OK (full matrix)
GET /api/v1/matrix?provider={name}                          -> 200 OK (filtered by provider)
GET /api/v1/matrix?consumer={name}                          -> 200 OK (filtered by consumer)
GET /api/v1/matrix?provider={name}&consumer={name}          -> 200 OK (filtered by both)
```

### Response: Compatibility Matrix

```json
{
    "entries": [
        {
            "providerName": "order-service",
            "providerVersion": "1.0.0",
            "consumerName": "payment-service",
            "consumerVersion": "2.1.0",
            "status": "SUCCESS",
            "branch": "main",
            "verifiedAt": "2026-01-15T10:30:00Z"
        },
        {
            "providerName": "order-service",
            "providerVersion": "1.0.0",
            "consumerName": "frontend",
            "consumerVersion": "3.0.0",
            "status": "FAILED",
            "branch": "main",
            "verifiedAt": "2026-01-14T08:15:00Z"
        }
    ],
    "totalEntries": 2
}
```

## Business Rules

1. Each matrix entry represents the most recent verification result for a unique provider-consumer version pair
2. If multiple verifications exist for the same provider-consumer version pair, only the latest is returned
3. The `provider` query parameter filters entries to those where the provider matches the given name
4. The `consumer` query parameter filters entries to those where the consumer matches the given name
5. Both `provider` and `consumer` can be combined to narrow results to a specific service pair
6. When no filters are provided, the full matrix across all applications is returned
7. Entries are ordered by `verifiedAt` descending (most recent first)
8. The `status` field reflects the verification status: SUCCESS or FAILED
9. The `branch` field indicates the branch on which the verification was performed
10. Version pairs with no verification records do not appear in the matrix

## Acceptance Criteria

### Full Matrix

**Given** "order-service" 1.0.0 has been verified by "payment-service" 2.0.0 with SUCCESS
**And** "order-service" 1.0.0 has been verified by "frontend" 3.0.0 with FAILED
**When** I GET `/api/v1/matrix`
**Then** I receive 200 OK
**And** the response contains 2 entries
**And** one entry shows SUCCESS for order-service/payment-service
**And** one entry shows FAILED for order-service/frontend

### Filter by Provider

**Given** verifications exist for providers "order-service" and "user-service"
**When** I GET `/api/v1/matrix?provider=order-service`
**Then** I receive 200 OK
**And** all entries have `providerName` equal to "order-service"
**And** no entries for "user-service" are included

### Filter by Consumer

**Given** verifications exist for consumers "payment-service" and "frontend"
**When** I GET `/api/v1/matrix?consumer=payment-service`
**Then** I receive 200 OK
**And** all entries have `consumerName` equal to "payment-service"

### Filter by Both

**Given** multiple verifications exist across several services
**When** I GET `/api/v1/matrix?provider=order-service&consumer=payment-service`
**Then** I receive 200 OK
**And** all entries have `providerName` "order-service" and `consumerName` "payment-service"

### Latest Verification Wins

**Given** "payment-service" 2.0.0 verified "order-service" 1.0.0 with FAILED at 10:00
**And** "payment-service" 2.0.0 verified "order-service" 1.0.0 with SUCCESS at 11:00
**When** I GET `/api/v1/matrix`
**Then** the entry for this version pair shows status SUCCESS and verifiedAt 11:00

### Empty Matrix

**Given** no verifications exist
**When** I GET `/api/v1/matrix`
**Then** I receive 200 OK
**And** `entries` is empty
**And** `totalEntries` is 0

## Error Cases

| Scenario | HTTP Status | Error Code |
|----------|-------------|------------|
| Provider name not found | 200 | (empty results, not an error) |
| Consumer name not found | 200 | (empty results, not an error) |
