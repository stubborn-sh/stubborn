# Data Cleanup

The broker provides configurable data retention to prevent unbounded database growth.

::: warning Spec contains incorrect field names
The spec at [docs/specs/018-data-cleanup.md](https://github.com/stubborn-sh/stubborn/blob/main/docs/specs/018-data-cleanup.md)
contains incorrect field names. Use the field names shown on this page, which reflect the
actual implementation.
:::

## API

### POST /api/v1/maintenance/cleanup

Requires the **ADMIN** role. Runs cleanup across all applications, or a single application
when `applicationName` is provided.

**Request body**

| Field | Type | Required | Description |
|---|---|---|---|
| `keepLatestVersions` | integer (min 1) | yes | Number of most-recent versions to retain per application |
| `applicationName` | string | no | Limit cleanup to a single application; omit to process all |
| `protectedEnvironments` | string array | no | Environment names whose deployed versions are never deleted |

```json
{
  "keepLatestVersions": 10,
  "applicationName": "order-service",
  "protectedEnvironments": ["production", "staging"]
}
```

**Response body**

| Field | Type | Description |
|---|---|---|
| `deletedCount` | integer | Total number of contracts removed |
| `deletedContracts` | string array | Each removed contract in `"app:version:contractName"` format |

```json
{
  "deletedCount": 3,
  "deletedContracts": [
    "order-service:1.0.0:get-orders",
    "order-service:1.0.0:create-order",
    "order-service:1.1.0:cancel-order"
  ]
}
```

**curl example**

```bash
curl -X POST https://broker.example.com/api/v1/maintenance/cleanup \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "keepLatestVersions": 10,
    "protectedEnvironments": ["production"]
  }'
```

## What Gets Cleaned

- **Old contract versions** — any version older than the most recent `keepLatestVersions`
  versions per application, unless protected
- **Contracts** belonging to deleted versions
- **Verification results** associated with deleted contracts

Versions are protected from deletion when any of the following apply:

- The version is among the most recent `keepLatestVersions` per application
- The version is currently deployed to an environment listed in `protectedEnvironments`
- The version carries a tag (see the tagging feature)

::: danger This operation is irreversible
Deleted versions, contracts, and verification results cannot be recovered. Test in a
non-production environment before running cleanup against production data.
:::

## Security

The `/api/v1/maintenance/cleanup` endpoint requires the **ADMIN** role. Requests from
users with the READER or PUBLISHER role receive `403 Forbidden`.
