# Feature 12: Content Hash Deduplication

## What

A SHA-256 content hash is computed for each contract at publish time. The hash enables
deduplication of identical contracts across versions and supports transitive verification,
where a contract verified successfully against one version can be considered verified
for another version with identical content.

## Why

Without content hashing, teams cannot:
- Detect when a contract has not changed between versions, avoiding redundant verification work
- Leverage transitive verification to speed up deployment pipelines
- Identify duplicate contracts published under different version numbers
- Confidently skip re-verification when contract content is unchanged

Content hashing provides a foundation for intelligent verification optimization without
sacrificing safety guarantees.

## How (High Level)

When a contract is published, the broker computes a SHA-256 hash of the contract content
field. The hash is stored alongside the contract and returned in all contract responses.
When checking verification status, the broker can find previous successful verifications
of contracts with the same content hash, treating them as transitively verified.

## API

```
POST /api/v1/contracts    -> 201 Created (contentHash auto-computed in response)
GET  /api/v1/contracts    -> 200 OK (contentHash included in each contract)
```

### Response: Contract with Content Hash

```json
{
    "id": "...",
    "applicationName": "order-service",
    "version": "1.2.0",
    "contractName": "shouldCreateOrder",
    "content": "...",
    "contentHash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "createdAt": "2026-01-15T10:30:00Z"
}
```

## Business Rules

1. The content hash is computed as SHA-256 of the `content` field at publish time
2. The content hash is immutable once computed; it is never recalculated
3. The content hash is returned in all contract responses (list and detail)
4. Two contracts with identical `content` produce identical content hashes regardless of application name, version, or other metadata
5. Transitive verification: if contract version A has the same content hash as contract version B, and version B has a successful verification, then version A is considered transitively verified
6. Transitive verification only applies when the provider is the same application
7. The content hash field is read-only; clients cannot set or override it

## Acceptance Criteria

### Content Hash Computed on Publish

**Given** application "order-service" exists
**When** I POST `/api/v1/contracts` with content "request: GET /orders"
**Then** I receive 201 Created
**And** the response includes a `contentHash` field with a 64-character hex string

### Same Content Produces Same Hash

**Given** application "order-service" exists
**When** I publish a contract with content "request: GET /orders" for version "1.0.0"
**And** I publish a contract with content "request: GET /orders" for version "2.0.0"
**Then** both contracts have the same `contentHash`

### Different Content Produces Different Hash

**Given** application "order-service" exists
**When** I publish a contract with content "request: GET /orders" for version "1.0.0"
**And** I publish a contract with content "request: POST /orders" for version "1.0.0"
**Then** the contracts have different `contentHash` values

### Transitive Verification

**Given** "order-service" version "1.0.0" has contract "shouldCreateOrder" with content hash "abc123"
**And** "order-service" version "1.0.0" has a successful verification from "payment-service"
**And** "order-service" version "2.0.0" has contract "shouldCreateOrder" with the same content hash "abc123"
**When** I check verification status for "order-service" version "2.0.0"
**Then** the contract is considered transitively verified

### Content Hash Included in List Response

**Given** contracts exist for "order-service"
**When** I GET `/api/v1/contracts?applicationName=order-service`
**Then** I receive 200 OK
**And** each contract in the response includes a `contentHash` field

## Error Cases

| Scenario | HTTP Status | Error Code |
|----------|-------------|------------|
| Contract content is empty | 400 | VALIDATION_ERROR |
| Contract content is null | 400 | VALIDATION_ERROR |
