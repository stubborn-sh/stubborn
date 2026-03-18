# Feature 9: Dependency Graph

## What

The dependency graph provides a visual and queryable representation of service
relationships derived from verification records. It shows which services depend on
each other through contracts, enabling impact analysis and change management.

## Why

Without a dependency graph, teams cannot:
- Understand the full impact of changing a service's contract
- Identify which consumers will be affected by a provider change
- Visualize the service topology across the organization
- Make informed decisions about deployment ordering

The graph is derived automatically from verification records rather than requiring
manual dependency declarations.

## How (High Level)

The graph is constructed from verification records. Each verification creates a
directed edge from consumer to provider. Nodes are applications registered in the
broker. When filtered by environment, only versions currently deployed to that
environment are included.

## API

```
GET /api/v1/graph                          -> 200 OK (full graph)
GET /api/v1/graph?environment=production   -> 200 OK (filtered by environment)
GET /api/v1/graph/applications/{name}      -> 200 OK (single app dependencies)
```

## Business Rules

1. Graph nodes are derived from all registered applications
2. Graph edges are derived from verification records (consumer verifies against provider)
3. Each edge includes: provider name/version, consumer name/version, verification status, timestamp
4. When `environment` query parameter is provided, only versions deployed to that environment appear
5. Application dependencies show both providers (services this app consumes) and consumers (services that consume this app)
6. Unknown application IDs in verifications are represented as "unknown" in the graph

## Acceptance Criteria

### Full Dependency Graph

**Given** applications "order-service" and "payment-service" exist
**And** a verification records "payment-service" 1.0.0 verified against "order-service" 1.0.0 with SUCCESS
**When** I GET `/api/v1/graph`
**Then** I receive 200 OK
**And** the response contains nodes for both applications
**And** the response contains an edge from "payment-service" to "order-service"

### Empty Graph

**Given** no verification records exist
**When** I GET `/api/v1/graph`
**Then** I receive 200 OK
**And** the response contains nodes for all registered applications
**And** the edges array is empty

### Filter by Environment

**Given** "order-service" 1.0.0 is deployed to "production"
**And** "order-service" 2.0.0 is deployed to "staging"
**When** I GET `/api/v1/graph?environment=production`
**Then** I receive 200 OK
**And** only edges involving version 1.0.0 of "order-service" are included

### Application Dependencies

**Given** "order-service" is both a provider (consumed by "frontend") and a consumer (uses "payment-service")
**When** I GET `/api/v1/graph/applications/order-service`
**Then** I receive 200 OK
**And** the response includes "payment-service" in providers
**And** the response includes "frontend" in consumers

### Unknown Application

**Given** no application named "nonexistent" exists
**When** I GET `/api/v1/graph/applications/nonexistent`
**Then** I receive 404 Not Found

## Error Cases

| Scenario | HTTP Status | Error Code |
|----------|-------------|------------|
| Application not found | 404 | APPLICATION_NOT_FOUND |
