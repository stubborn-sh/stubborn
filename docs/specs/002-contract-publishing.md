# Feature 2: Contract/Stub Publishing

## What

Applications publish their API contracts (Spring Cloud Contract YAML/Groovy/Java DSL) to the broker,
organized by application name and version. The broker stores contract content and makes it retrievable
for consumers to verify against.

## Why

- Central repository for all contracts — consumers know where to find them
- Versioned contracts enable tracking API evolution over time
- Contracts stored in the broker can be served to Spring Cloud Contract Stub Runner
- Provides the foundation for verification results (Feature 3) and can-i-deploy (Feature 5)

## Who

- **Producers** publish contracts after defining their API behavior
- **Consumers** retrieve contracts to generate stubs and run consumer-driven contract tests
- **CI/CD pipelines** publish contracts as part of the build process

## How It Works

1. Producer registers their application (Feature 1)
2. Producer publishes one or more contracts for a specific version of their application
3. Each contract has a unique name within a version, content (YAML/JSON/Groovy), and a content type
4. Consumers or CI pipelines retrieve contracts by application name and version
5. Individual contracts can be retrieved by name
6. Contracts for a version can be deleted (e.g., to republish corrected contracts)

## API Endpoints

```
POST   /api/v1/applications/{name}/versions/{version}/contracts          -> 201 + Location
GET    /api/v1/applications/{name}/versions/{version}/contracts          -> 200 (paginated)
GET    /api/v1/applications/{name}/versions/{version}/contracts/{contractName}  -> 200
DELETE /api/v1/applications/{name}/versions/{version}/contracts/{contractName}  -> 204
```

### Query Parameters (List)

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | int | 0 | Zero-indexed page number |
| `size` | int | 20 | Page size |
| `sort` | string | `createdAt,desc` | Sort field and direction |

## Business Rules

- Application must exist before contracts can be published
- Version follows semantic versioning pattern (e.g., `1.0.0`, `2.1.3-SNAPSHOT`)
- Contract name must be unique within a given application+version combination
- Contract content must not be empty
- Contract content type indicates format: `application/x-spring-cloud-contract+yaml`,
  `application/x-spring-cloud-contract+groovy`, or `application/json`
- Publishing a contract with a name that already exists for that version returns 409 Conflict
- Deleting a non-existent contract returns 404

## Error Cases

- Application not found: 404 with `APPLICATION_NOT_FOUND`
- Invalid version format: 400 with `VALIDATION_ERROR`
- Duplicate contract name within version: 409 with `CONTRACT_ALREADY_EXISTS`
- Contract not found: 404 with `CONTRACT_NOT_FOUND`
- Empty contract content: 400 with `VALIDATION_ERROR`

## Acceptance Criteria

- Given a registered application "order-service"
  When I publish a contract named "create-order" for version "1.0.0"
  Then I receive 201 Created with a Location header

- Given a registered application "order-service" with contracts for version "1.0.0"
  When I list contracts for version "1.0.0"
  Then I receive all contracts for that version

- Given a published contract "create-order" for "order-service" version "1.0.0"
  When I retrieve the contract by name
  Then I receive the full contract content

- Given a published contract "create-order" for "order-service" version "1.0.0"
  When I publish another contract with the same name for version "1.0.0"
  Then I receive 409 Conflict

- Given no registered application "unknown-service"
  When I try to publish a contract for "unknown-service"
  Then I receive 404 Not Found
