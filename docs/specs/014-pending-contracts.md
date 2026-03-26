# Feature 14: Pending Contracts

## What

A contract is "pending" for a provider branch if that branch has never successfully
verified it. Pending contracts are treated leniently in can-i-deploy checks: verification
failures against pending contracts do not block deployment. Once a contract has been
successfully verified on a branch, it is no longer pending for that branch and subsequent
failures will block deployment.

## Why

Without pending contract support, teams cannot:
- Introduce new consumer contracts without immediately blocking the provider's deployment pipeline
- Allow providers to gradually adopt new contracts at their own pace
- Distinguish between regressions (previously passing, now failing) and new contracts (never passed)
- Enable consumer-driven contract workflows where consumers publish contracts before providers implement them

Pending contracts are essential for consumer-driven development, allowing consumers to
express expectations without creating an immediate hard dependency on provider compliance.

## How (High Level)

When evaluating can-i-deploy, the broker checks each unverified or failed contract
against the provider's verification history for the target branch. If no successful
verification has ever been recorded for that contract on the given branch, the contract
is marked as "pending" and its failure does not count against deployment safety. Once
a successful verification exists for that contract on the branch, it becomes "active"
and any subsequent failure blocks deployment.

## API

```
GET /api/v1/can-i-deploy?application={name}&version={v}&branch={b}&includePending=true
    -> 200 OK (includes pendingContracts array)
```

### Response: Can I Deploy with Pending

```json
{
    "safe": true,
    "summary": "All active contracts verified. 2 pending contracts ignored.",
    "verifiedContracts": [...],
    "pendingContracts": [
        {
            "consumerName": "new-frontend",
            "consumerVersion": "1.0.0",
            "contractName": "shouldReturnUserProfile",
            "status": "PENDING",
            "reason": "Never verified successfully on branch main"
        }
    ],
    "failedContracts": []
}
```

## Business Rules

1. A contract is "pending" for a branch if no verification with status SUCCESS has ever been recorded for that contract on that branch
2. Pending status is evaluated per provider branch; a contract can be pending on one branch but active on another
3. When `includePending=true`, pending contract failures do not affect the `safe` result
4. When `includePending=false` or omitted, pending contracts are treated the same as active contracts (failures block deployment)
5. Once a contract receives a successful verification on a branch, it transitions from pending to active permanently for that branch
6. The pending status is determined by the combination of: consumer name, contract name, and provider branch
7. Pending contracts are always included in the response for visibility, regardless of the `includePending` parameter
8. The `summary` field in the response indicates how many pending contracts were excluded from the safety evaluation

## Acceptance Criteria

### New Contract is Pending

**Given** "order-service" exists with main branch "main"
**And** "payment-service" publishes a new contract against "order-service"
**And** no verification exists for this contract on branch "main"
**When** I GET `/api/v1/can-i-deploy?application=order-service&version=1.0.0&branch=main&includePending=true`
**Then** I receive 200 OK
**And** the contract appears in `pendingContracts`
**And** `safe` is true

### Pending Contract Failure Does Not Block

**Given** "payment-service" has a contract against "order-service" that has never been verified on branch "main"
**And** a FAILED verification is recorded for this contract on branch "main"
**When** I GET `/api/v1/can-i-deploy?application=order-service&version=1.0.0&branch=main&includePending=true`
**Then** I receive 200 OK
**And** `safe` is true
**And** the contract appears in `pendingContracts`

### Previously Verified Contract Failure Blocks

**Given** "payment-service" has a contract against "order-service"
**And** a SUCCESS verification was previously recorded for this contract on branch "main"
**And** a new FAILED verification is recorded for this contract on branch "main"
**When** I GET `/api/v1/can-i-deploy?application=order-service&version=2.0.0&branch=main&includePending=true`
**Then** I receive 200 OK
**And** `safe` is false
**And** the contract appears in `failedContracts`

### Pending on One Branch, Active on Another

**Given** "payment-service" has a contract against "order-service"
**And** this contract has been successfully verified on branch "main"
**And** this contract has never been verified on branch "feature/v2"
**When** I check can-i-deploy for branch "feature/v2" with `includePending=true`
**Then** the contract is pending for branch "feature/v2"
**When** I check can-i-deploy for branch "main" with `includePending=true`
**Then** the contract is active for branch "main"

### Include Pending Disabled

**Given** a pending contract exists with a FAILED verification
**When** I GET `/api/v1/can-i-deploy?application=order-service&version=1.0.0` (without includePending)
**Then** `safe` is false
**And** the contract is treated as a regular failed contract

## Error Cases

| Scenario | HTTP Status | Error Code |
|----------|-------------|------------|
| Application not found | 404 | APPLICATION_NOT_FOUND |
| Version not found | 404 | VERSION_NOT_FOUND |
| Invalid includePending value | 400 | VALIDATION_ERROR |
