# Feature 15: Consumer Version Selectors

## What

Consumer version selectors provide a rich query system for providers to select which
consumer contract versions to verify against. Instead of verifying against all consumer
versions or a single hardcoded version, providers can define selectors that dynamically
resolve to the relevant set of consumer contracts based on branch, deployment status,
or consumer identity.

## Why

Without consumer version selectors, teams cannot:
- Verify only against contracts from consumers deployed to production
- Verify against contracts from the consumer's main branch without hardcoding versions
- Combine multiple selection criteria (e.g., all deployed contracts plus the latest from a specific branch)
- Avoid verifying against stale or irrelevant consumer contract versions

Consumer version selectors enable providers to define a verification matrix that is
both comprehensive and efficient, reducing unnecessary verification cycles while
ensuring coverage of all relevant consumer versions.

## How (High Level)

Providers submit an array of selectors to the resolve endpoint. Each selector defines
criteria for selecting consumer contract versions. The broker evaluates all selectors,
collects matching contract versions, deduplicates by consumer-version-contractName, and
returns the resolved set. Providers then verify against exactly this set of contracts.

## API

```
POST /api/v1/selectors/resolve    -> 200 OK (resolved contract versions)
```

### Request: Resolve Selectors

```json
{
    "providerName": "order-service",
    "providerBranch": "main",
    "selectors": [
        {
            "mainBranch": true
        },
        {
            "branch": "feature/new-endpoint"
        },
        {
            "consumer": "payment-service"
        },
        {
            "deployed": true,
            "environment": "production"
        }
    ]
}
```

### Response: Resolved Contracts

```json
{
    "providerName": "order-service",
    "selectors": [...],
    "resolvedContracts": [
        {
            "consumerName": "payment-service",
            "consumerVersion": "2.1.0",
            "contractName": "shouldProcessPayment",
            "branch": "main",
            "contentHash": "abc123...",
            "source": "mainBranch"
        },
        {
            "consumerName": "frontend",
            "consumerVersion": "3.0.0-SNAPSHOT",
            "contractName": "shouldGetOrders",
            "branch": "feature/new-endpoint",
            "contentHash": "def456...",
            "source": "branch"
        }
    ],
    "totalResolved": 2
}
```

## Selector Types

| Selector | Field | Description |
|----------|-------|-------------|
| Main Branch | `mainBranch: true` | Latest version from each consumer's configured main branch |
| Branch | `branch: "feature/x"` | Latest version from each consumer on the specified branch |
| Consumer | `consumer: "name"` | Latest version from the specified consumer (any branch) |
| Deployed | `deployed: true, environment: "prod"` | Versions currently deployed to the specified environment |

## Business Rules

1. The `providerName` field is required and must reference an existing application
2. At least one selector must be provided in the `selectors` array
3. Each selector must have exactly one selection criterion (`mainBranch`, `branch`, `consumer`, or `deployed`)
4. The `mainBranch` selector resolves to the latest contract version published on each consumer's configured main branch
5. The `branch` selector resolves to the latest contract version published on the specified branch for each consumer
6. The `consumer` selector resolves to the latest contract version from the named consumer regardless of branch
7. The `deployed` selector requires an `environment` field and resolves to contract versions currently deployed to that environment
8. Results are deduplicated by consumer name + consumer version + contract name; if multiple selectors match the same contract, it appears once
9. The `source` field in each resolved contract indicates which selector matched it
10. If a selector matches no contracts, it contributes zero results (not an error)
11. Only contracts that target the specified `providerName` are considered

## Acceptance Criteria

### Resolve Main Branch Selector

**Given** "payment-service" has main branch "main" and published contracts on branch "main" version "2.0.0"
**And** "payment-service" also has contracts on branch "feature/x" version "2.1.0-SNAPSHOT"
**When** I POST `/api/v1/selectors/resolve` with selector `{"mainBranch": true}` for provider "order-service"
**Then** I receive 200 OK
**And** the resolved contracts include "payment-service" version "2.0.0"
**And** the resolved contracts do not include "payment-service" version "2.1.0-SNAPSHOT"

### Resolve Branch Selector

**Given** "frontend" has contracts on branch "feature/redesign" version "3.0.0-SNAPSHOT"
**When** I POST `/api/v1/selectors/resolve` with selector `{"branch": "feature/redesign"}` for provider "order-service"
**Then** I receive 200 OK
**And** the resolved contracts include "frontend" version "3.0.0-SNAPSHOT" with source "branch"

### Resolve Deployed Selector

**Given** "payment-service" version "1.5.0" is deployed to "production"
**And** "payment-service" version "2.0.0" is deployed to "staging"
**When** I POST `/api/v1/selectors/resolve` with selector `{"deployed": true, "environment": "production"}` for provider "order-service"
**Then** I receive 200 OK
**And** the resolved contracts include "payment-service" version "1.5.0"
**And** the resolved contracts do not include "payment-service" version "2.0.0"

### Resolve Consumer Selector

**Given** "payment-service" has contracts targeting "order-service" at versions "1.0.0" and "2.0.0"
**When** I POST `/api/v1/selectors/resolve` with selector `{"consumer": "payment-service"}` for provider "order-service"
**Then** I receive 200 OK
**And** the resolved contracts include the latest "payment-service" version

### Multiple Selectors Deduplicated

**Given** "payment-service" version "2.0.0" is on the main branch and deployed to production
**When** I POST `/api/v1/selectors/resolve` with selectors `[{"mainBranch": true}, {"deployed": true, "environment": "production"}]`
**Then** "payment-service" version "2.0.0" appears only once in the results

### Empty Selector Result

**Given** no consumers have contracts on branch "nonexistent-branch"
**When** I POST `/api/v1/selectors/resolve` with selector `{"branch": "nonexistent-branch"}`
**Then** I receive 200 OK
**And** `resolvedContracts` is empty
**And** `totalResolved` is 0

## Error Cases

| Scenario | HTTP Status | Error Code |
|----------|-------------|------------|
| Provider not found | 404 | APPLICATION_NOT_FOUND |
| Empty selectors array | 400 | VALIDATION_ERROR |
| Selector with no criteria | 400 | VALIDATION_ERROR |
| Selector with multiple criteria | 400 | VALIDATION_ERROR |
| Deployed selector without environment | 400 | VALIDATION_ERROR |
