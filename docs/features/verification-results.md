# Verification Results

Record and query contract verification outcomes between producers and consumers.

## What is a verification result?

When a producer runs their contract tests, the Stubborn Maven or Gradle plugin records the
outcome in the broker. This tells the broker: "Version X of service Y has tested against
Consumer Z's contracts and the result was PASSED or FAILED."

These results are the raw material for [Can I Deploy](can-i-deploy.md): before any service
version is released, Can I Deploy checks whether all of its counterparts have a recorded
SUCCESS for the same contract. If a result is missing or FAILED, the deployment is blocked.

Verification results are **immutable** once recorded. If a version fails and you want to
unblock deployment, you must release a new version that passes.

## How recording works

The Stubborn plugin records results automatically as part of the test run. You do not need
to call the API manually.

When the provider test suite finishes:

- If all generated contract tests pass, the plugin records `SUCCESS`.
- If any test fails, the plugin records `FAILED` — the test failure does **not** prevent
  recording. The broker always learns the real outcome so that Can I Deploy can make an
  accurate decision.

### Maven plugin configuration

```xml
<plugin>
  <groupId>io.stubborn</groupId>
  <artifactId>stubborn-contract-verifier-maven-plugin</artifactId>
  <configuration>
    <brokerUrl>http://localhost:8080</brokerUrl>
    <!-- provider name and version are auto-detected from the generated test classes -->
  </configuration>
</plugin>
```

The plugin derives the provider name and version from your project coordinates and the
generated test class metadata. No additional configuration is required for basic usage.

## What happens when tests fail?

The plugin records the result as `FAILED`. When a downstream pipeline calls Can I Deploy for
that provider version, the broker returns `safe: false` — deployment is blocked. The only
way to unblock is to cut a new provider version whose tests pass and record a `SUCCESS` for
that version.

This means test failures are never silently ignored: they leave a permanent, queryable
record in the broker.

## API

Both provider and consumer **applications must already be registered** (see
[Application Registration](application-registration.md)) before a verification result can be recorded. The provider
version must follow semantic versioning. A duplicate submission for the same
provider + providerVersion + consumer + consumerVersion combination returns `409 Conflict`.

### Record a verification result

```
POST /api/v1/verifications
```

Request body:

```json
{
  "provider": "fraud-service",
  "providerVersion": "1.2.3",
  "consumer": "loan-service",
  "consumerVersion": "2.0.0",
  "status": "SUCCESS"
}
```

`status` must be one of:

| Value | Meaning |
|-------|---------|
| `SUCCESS` | All contract tests passed |
| `FAILED` | One or more contract tests failed |

Response: `201 Created` with a `Location` header pointing to the new resource.

Error responses:

| Status | Code | Cause |
|--------|------|-------|
| 400 | `VALIDATION_ERROR` | Invalid version format or missing required field |
| 404 | `APPLICATION_NOT_FOUND` | Provider or consumer application not registered |
| 409 | `VERIFICATION_ALREADY_EXISTS` | Result already recorded for this combination |

### List verification results

```
GET /api/v1/verifications
```

Query parameters:

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `provider` | string | — | Filter by provider application name |
| `providerVersion` | string | — | Filter by provider version |
| `search` | string | — | Case-insensitive match on provider or consumer name |
| `page` | int | 0 | Zero-indexed page number |
| `size` | int | 20 | Page size |
| `sort` | string | `createdAt,desc` | Sort field and direction |

Response: `200 OK` with a paginated list of verification result objects.

### Get a single verification result

```
GET /api/v1/verifications/{id}
```

`{id}` is the UUID returned in the `Location` header when the result was recorded.

Response: `200 OK` with the verification result, or `404` with `VERIFICATION_NOT_FOUND`.

## Specification

the [Verification Results spec](https://github.com/stubborn-sh/stubborn/blob/main/docs/specs/003-verification-results.md)
