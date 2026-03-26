# Feature 11: Branch Support

## What

Branch support enables tracking contracts and verifications per source code branch.
Applications have a configurable main branch (defaulting to "main"). Contracts and
verifications can be associated with a specific branch, and can-i-deploy checks can
be scoped to a particular branch.

## Why

Without branch support, teams cannot:
- Publish contracts from feature branches without polluting the main verification state
- Verify provider compatibility against contracts from a specific branch
- Determine deployment safety for a particular branch rather than the entire application
- Distinguish between main-branch contracts and experimental feature-branch contracts

Branch awareness is essential for trunk-based development and feature-branch workflows
where contracts evolve independently before merging.

## How (High Level)

Each application stores a `mainBranch` field (default "main"). When contracts are
published, the optional `branch` field is recorded alongside the contract. Verifications
also accept an optional `branch` field. The can-i-deploy endpoint accepts an optional
`branch` query parameter to filter verifications by branch, ensuring deployment safety
checks reflect the correct branch context.

## API

```
PUT  /api/v1/applications/{name}                        -> 200 OK (update mainBranch)
POST /api/v1/contracts                                   -> 201 Created (with optional branch)
POST /api/v1/verifications                               -> 201 Created (with optional branch)
GET  /api/v1/can-i-deploy?application={name}&version={v}&branch={b} -> 200 OK
```

### Request: Update Application

```json
{
    "mainBranch": "develop"
}
```

### Request: Publish Contract with Branch

```json
{
    "applicationName": "order-service",
    "version": "1.2.0",
    "branch": "feature/new-endpoint",
    "contracts": [...]
}
```

### Request: Publish Verification with Branch

```json
{
    "providerName": "order-service",
    "providerVersion": "1.2.0",
    "consumerName": "payment-service",
    "consumerVersion": "2.0.0",
    "branch": "feature/new-endpoint",
    "status": "SUCCESS"
}
```

## Business Rules

1. The `mainBranch` field defaults to "main" when an application is registered
2. The `mainBranch` field can be updated via PUT on the application resource
3. The `branch` field on contracts and verifications is optional; when omitted, the application's `mainBranch` is assumed
4. Contracts published on different branches are stored independently
5. Verifications are associated with a branch; a verification on one branch does not satisfy another branch
6. The can-i-deploy endpoint, when `branch` is provided, only considers verifications on that branch
7. The can-i-deploy endpoint, when `branch` is omitted, considers verifications on the application's `mainBranch`

## Acceptance Criteria

### Register Application with Main Branch

**Given** no application named "order-service" exists
**When** I POST `/api/v1/applications` with name "order-service"
**Then** I receive 201 Created
**And** the response includes `mainBranch` equal to "main"

### Update Main Branch

**Given** application "order-service" exists with `mainBranch` "main"
**When** I PUT `/api/v1/applications/order-service` with `mainBranch` "develop"
**Then** I receive 200 OK
**And** the response includes `mainBranch` equal to "develop"

### Publish Contract on Branch

**Given** application "order-service" exists
**When** I POST `/api/v1/contracts` with `branch` "feature/new-endpoint"
**Then** I receive 201 Created
**And** the contract is associated with branch "feature/new-endpoint"

### Publish Verification on Branch

**Given** a contract exists for "order-service" on branch "feature/new-endpoint"
**When** I POST `/api/v1/verifications` with `branch` "feature/new-endpoint" and status SUCCESS
**Then** I receive 201 Created
**And** the verification is associated with branch "feature/new-endpoint"

### Can I Deploy with Branch Filter

**Given** "order-service" 1.0.0 has a successful verification on branch "main"
**And** "order-service" 1.0.0 has no verification on branch "feature/new-endpoint"
**When** I GET `/api/v1/can-i-deploy?application=order-service&version=1.0.0&branch=feature/new-endpoint`
**Then** I receive 200 OK
**And** the response indicates deployment is NOT safe

### Can I Deploy without Branch Defaults to Main Branch

**Given** "order-service" has `mainBranch` "main"
**And** "order-service" 1.0.0 has a successful verification on branch "main"
**When** I GET `/api/v1/can-i-deploy?application=order-service&version=1.0.0`
**Then** I receive 200 OK
**And** the response indicates deployment is safe

## Error Cases

| Scenario | HTTP Status | Error Code |
|----------|-------------|------------|
| Application not found for update | 404 | APPLICATION_NOT_FOUND |
| Invalid branch name (empty string) | 400 | VALIDATION_ERROR |
| Application not found for can-i-deploy | 404 | APPLICATION_NOT_FOUND |
