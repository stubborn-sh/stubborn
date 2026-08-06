# Compatibility Matrix

## What is the compatibility matrix?

The compatibility matrix shows, for every combination of provider version and consumer version,
whether the provider's tests passed against the consumer's contracts. It gives you a bird's-eye
view of which combinations are safe to deploy together.

Each cell in the matrix reflects the most recent verification result for that pair. If a
provider publishes a new version and re-runs contract tests against a consumer's stubs, the
cell updates to the latest outcome. Pairs that have never been verified do not appear in the
matrix.

## Visual example

|                  | Consumer v2.0 | Consumer v1.9 | Consumer v1.8 |
|------------------|:-------------:|:-------------:|:-------------:|
| **Provider v3.1** | ✅ Pass       | ✅ Pass       | ❌ Fail       |
| **Provider v3.0** | ✅ Pass       | ✅ Pass       | ✅ Pass       |

Reading the table: Provider v3.1 is safe to deploy against Consumer v2.0 and v1.9, but breaks
against Consumer v1.8. Provider v3.0 works with all three consumer versions currently tracked.

## API

### Query the matrix

```
GET /api/v1/matrix
GET /api/v1/matrix?provider={name}
GET /api/v1/matrix?consumer={name}
GET /api/v1/matrix?provider={name}&consumer={name}
```

**Example — filter by provider and consumer:**

```bash
curl -s \
  -H "Authorization: Bearer $TOKEN" \
  "https://stubborn.example.com/api/v1/matrix?provider=fraud-service&consumer=loan-service"
```

### Response: 200 OK

```json
{
    "entries": [
        {
            "providerName": "fraud-service",
            "providerVersion": "3.1.0",
            "consumerName": "loan-service",
            "consumerVersion": "2.0.0",
            "status": "SUCCESS",
            "branch": "main",
            "verifiedAt": "2026-07-20T10:30:00Z"
        },
        {
            "providerName": "fraud-service",
            "providerVersion": "3.1.0",
            "consumerName": "loan-service",
            "consumerVersion": "1.8.0",
            "status": "FAILED",
            "branch": "main",
            "verifiedAt": "2026-07-19T14:15:00Z"
        }
    ],
    "totalEntries": 2
}
```

Each entry contains:

| Field | Description |
|-------|-------------|
| `providerName` | Name of the service that published the contracts |
| `providerVersion` | Version of the provider under test |
| `consumerName` | Name of the consuming service |
| `consumerVersion` | Version of the consumer whose stubs were used |
| `status` | `SUCCESS` or `FAILED` |
| `branch` | Branch on which verification was performed |
| `verifiedAt` | Timestamp of the most recent verification for this pair |

When no filters are provided the full matrix across all applications is returned. When a filter
names a provider or consumer that exists in the system but has no verifications, the response
is `200 OK` with an empty `entries` array and `totalEntries: 0`.

### Error responses

| Scenario | HTTP Status |
|----------|-------------|
| Unknown provider or consumer name (no records match) | 200 OK — empty `entries` |

## Use cases

### Rollback decisions

When a consumer version is rolled back in production, the matrix answers: "which provider
version was verified against the consumer version currently in prod?" Filter by the consumer
name, find the consumer version that is live, and read across the row to see which provider
versions show `SUCCESS`.

### Release gating

Before promoting a new provider version to production, verify that all consumer versions
currently deployed show `SUCCESS` for that provider version. If any consumer shows `FAILED`,
the provider is not safe to release until the contract break is resolved or the consumer is
updated.

## Specification

Full acceptance criteria and business rules: [Compatibility Matrix spec](https://github.com/stubborn-sh/stubborn/blob/main/docs/specs/016-compatibility-matrix.md)
