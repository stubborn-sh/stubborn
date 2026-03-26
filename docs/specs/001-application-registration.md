# Feature 1: Application Registration

## What

Applications (producers and consumers) must be registered in the broker before they can
publish contracts, record verification results, or track deployments. Registration
establishes the identity of a participant in the contract ecosystem.

## Why

Without a registry of known applications, the broker cannot:
- Associate contracts with their producer
- Track which consumer verified which contract
- Determine deployment safety (can-i-deploy)
- Enforce ownership and access control

The application registry is the foundation that all other features depend on.

## How (High Level)

Users register an application by providing a unique name, optional description, and owner.
The broker stores this and returns a persistent identity. Applications can be listed,
looked up by name, and deleted when no longer needed.

## API

```
POST   /api/v1/applications          -> 201 Created + Location header
GET    /api/v1/applications          -> 200 OK (paginated, searchable)
GET    /api/v1/applications/{name}   -> 200 OK
DELETE /api/v1/applications/{name}   -> 204 No Content
```

### Query Parameters (List)

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `search` | string | - | Case-insensitive filter on application name |
| `page` | int | 0 | Zero-indexed page number |
| `size` | int | 20 | Page size |
| `sort` | string | `createdAt,desc` | Sort field and direction |

## Business Rules

1. Application name must be unique (case-sensitive)
2. Application name must match `^[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]$` (alphanumeric + hyphens, no leading/trailing hyphens, min 2 chars) OR be a single alphanumeric char
3. Application name max length: 128 characters
4. Description is optional, max 1000 characters
5. Owner is required, max 100 characters
6. Deleting an application that has published contracts or active deployments is forbidden

## Acceptance Criteria

### Register Application

**Given** no application named "order-service" exists
**When** I POST to `/api/v1/applications` with `{"name": "order-service", "description": "Manages orders", "owner": "team-commerce"}`
**Then** I receive 201 Created
**And** the Location header is `/api/v1/applications/order-service`
**And** the response body contains the application with `createdAt` timestamp

### Reject Duplicate Name

**Given** an application named "order-service" already exists
**When** I POST to `/api/v1/applications` with `{"name": "order-service", ...}`
**Then** I receive 409 Conflict
**And** the error code is "APPLICATION_ALREADY_EXISTS"

### Reject Invalid Name

**Given** any state
**When** I POST to `/api/v1/applications` with `{"name": "-invalid-", ...}`
**Then** I receive 400 Bad Request
**And** the error code is "VALIDATION_ERROR"

### List Applications (Paginated)

**Given** 25 applications exist
**When** I GET `/api/v1/applications?page=0&size=10&sort=createdAt,desc`
**Then** I receive 200 OK with 10 applications, totalElements=25, totalPages=3

### Search Applications

**Given** 25 applications exist, 3 containing "order" in their name
**When** I GET `/api/v1/applications?search=order&page=0&size=20`
**Then** I receive 200 OK with 3 matching applications

### Get Application by Name

**Given** an application named "order-service" exists
**When** I GET `/api/v1/applications/order-service`
**Then** I receive 200 OK with the application details

### Application Not Found

**Given** no application named "nonexistent" exists
**When** I GET `/api/v1/applications/nonexistent`
**Then** I receive 404 Not Found
**And** the error code is "APPLICATION_NOT_FOUND"

### Delete Application

**Given** an application named "order-service" exists with no contracts or deployments
**When** I DELETE `/api/v1/applications/order-service`
**Then** I receive 204 No Content
**And** the application is no longer retrievable

## Error Cases

| Scenario | HTTP Status | Error Code |
|----------|-------------|------------|
| Duplicate name | 409 | APPLICATION_ALREADY_EXISTS |
| Invalid name format | 400 | VALIDATION_ERROR |
| Name too long (>128) | 400 | VALIDATION_ERROR |
| Missing required fields | 400 | VALIDATION_ERROR |
| Application not found | 404 | APPLICATION_NOT_FOUND |
| Delete with contracts | 409 | APPLICATION_HAS_CONTRACTS |
