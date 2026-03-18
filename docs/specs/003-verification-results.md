# Feature 3: Verification Results

## What

Consumers report the results of their contract verification tests to the broker.
Each verification records whether a consumer successfully verified against a
producer's contracts for a specific version.

## Why

- Tracks which consumers have verified against which producer versions
- Provides input for the "Can I Deploy" decision (Feature 5)
- Creates an audit trail of contract compatibility between services
- Enables teams to know when it's safe to release a new version

## Who

- **Consumers** report verification results after running contract tests
- **CI/CD pipelines** report results as part of the build process
- **Operators** query results to understand service compatibility

## How It Works

1. Consumer runs contract tests against producer's contracts (from the broker)
2. Consumer reports the result: pass or fail, for a specific producer version
3. Results are immutable once recorded
4. Results can be queried by producer name + version, or by consumer name

## API Endpoints

```
POST   /api/v1/verifications                                    -> 201 + Location
GET    /api/v1/verifications?provider={name}&providerVersion={version}  -> 200 (paginated, searchable)
GET    /api/v1/verifications/{id}                                -> 200
```

### Query Parameters (List)

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `provider` | string | - | Filter by provider application name |
| `providerVersion` | string | - | Filter by provider version |
| `search` | string | - | Case-insensitive filter on provider/consumer names |
| `page` | int | 0 | Zero-indexed page number |
| `size` | int | 20 | Page size |
| `sort` | string | `createdAt,desc` | Sort field and direction |

## Business Rules

- Both provider and consumer applications must exist (registered via Feature 1)
- Provider version must follow semantic versioning
- A verification result is immutable — once recorded, cannot be changed
- Duplicate verification (same provider+version+consumer+consumerVersion) returns 409
- Status must be either `SUCCESS` or `FAILED`
- Verification includes: provider name, provider version, consumer name,
  consumer version, status, and optional details/error message

## Error Cases

- Provider application not found: 404 with `APPLICATION_NOT_FOUND`
- Consumer application not found: 404 with `APPLICATION_NOT_FOUND`
- Invalid version format: 400 with `VALIDATION_ERROR`
- Duplicate verification: 409 with `VERIFICATION_ALREADY_EXISTS`
- Verification not found: 404 with `VERIFICATION_NOT_FOUND`

## Acceptance Criteria

- Given registered apps "order-service" (provider) and "payment-service" (consumer)
  When payment-service reports SUCCESS for order-service version "1.0.0"
  Then I receive 201 Created with the verification ID

- Given a recorded verification
  When I query verifications for order-service version "1.0.0"
  Then I see the verification result including consumer details

- Given a recorded verification for order-service 1.0.0 by payment-service 2.0.0
  When payment-service reports again for the same combination
  Then I receive 409 Conflict
