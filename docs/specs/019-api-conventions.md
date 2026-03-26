# Cross-Cutting: API Conventions

## What

Standard conventions applied across all broker REST API endpoints. These define the
common patterns for pagination, search, sorting, error responses, and content negotiation
that every feature follows consistently.

## Why

Without consistent API conventions, consumers of the API (UI, MCP server, plugins, CI/CD
pipelines) must handle different response formats per endpoint. Standardized conventions
reduce integration effort and ensure predictable behavior.

## Pagination

All list endpoints return paginated responses. The response wraps the results in a page
envelope:

```json
{
    "content": [ ... ],
    "page": 0,
    "size": 20,
    "totalElements": 142,
    "totalPages": 8
}
```

- `page` is zero-indexed
- Default `size` is 20
- Default sort is `createdAt,desc` (newest first)
- Clients can override via query parameters: `?page=0&size=50&sort=name,asc`

**Exceptions**: The matrix endpoint (`/api/v1/matrix`) and graph endpoint (`/api/v1/graph`)
return full result sets (arrays or objects) because their data is relational and typically
small enough to return in one response.

## Search

Endpoints that support free-text search accept a `search` query parameter:

| Endpoint | Search matches on |
|----------|-------------------|
| `GET /api/v1/applications` | Application name |
| `GET /api/v1/verifications` | Provider or consumer name |
| `GET /api/v1/webhooks` | Webhook URL |

Search is case-insensitive substring matching. Search resets pagination to page 0.

## Error Responses

All error responses follow a consistent structure:

```json
{
    "code": "APPLICATION_NOT_FOUND",
    "message": "Application not found: order-service",
    "traceId": "abc-123-def",
    "timestamp": "2026-01-15T10:30:00Z",
    "details": {
        "name": "Must match pattern ^[a-zA-Z0-9]..."
    }
}
```

- `code` is machine-readable (e.g., `VALIDATION_ERROR`, `APPLICATION_NOT_FOUND`)
- `message` is human-readable
- `traceId` correlates with distributed trace
- `details` is optional and contains field-level validation errors when applicable

## HTTP Status Codes

| Status | When |
|--------|------|
| 200 | Successful GET, PUT |
| 201 | Successful POST (with Location header) |
| 204 | Successful DELETE |
| 400 | Validation error |
| 401 | Not authenticated |
| 403 | Insufficient role |
| 404 | Resource not found |
| 409 | Conflict (duplicate, state conflict) |

## Content Type

All request and response bodies use `application/json`. Dates use ISO 8601 with UTC
timezone (`2026-01-15T10:30:00Z`). Field names use camelCase.

## Versioning

All endpoints are prefixed with `/api/v1/`. Breaking changes require a new version prefix.
