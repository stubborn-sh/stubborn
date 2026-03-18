# Feature 6: Security

## What
Role-based access control (RBAC) protecting all API endpoints. Supports HTTP Basic
authentication (for development/CI) and OAuth2/OIDC bearer tokens (for production).

## Why
The broker stores sensitive contract and deployment data. Without authentication,
anyone could modify application registrations, publish fake contracts, or record
false verifications — leading to incorrect can-i-deploy results.

## How (High Level)
Three roles with increasing privileges:
- **READER**: Can read all resources (GET endpoints)
- **PUBLISHER**: Can read + create/modify contracts, verifications, deployments
- **ADMIN**: Full access including application management and environment configuration

## Business Rules
- All `/api/v1/**` endpoints require authentication
- Health endpoints (`/actuator/health/**`) are public
- CSRF is disabled (stateless API)
- HTTP Basic is always enabled (for CI/dev)
- OAuth2 resource server is conditionally enabled

## Role Matrix

| Endpoint | READER | PUBLISHER | ADMIN |
|----------|--------|-----------|-------|
| GET /api/v1/applications | Yes | Yes | Yes |
| POST /api/v1/applications | No | No | Yes |
| DELETE /api/v1/applications/{name} | No | No | Yes |
| POST /api/v1/.../contracts | No | Yes | Yes |
| GET /api/v1/.../contracts | Yes | Yes | Yes |
| POST /api/v1/verifications | No | Yes | Yes |
| GET /api/v1/verifications | Yes | Yes | Yes |
| POST /api/v1/environments/.../deployments | No | Yes | Yes |
| GET /api/v1/environments/.../deployments | Yes | Yes | Yes |
| GET /api/v1/can-i-deploy | Yes | Yes | Yes |
| GET /api/v1/graph | Yes | Yes | Yes |
| GET /api/v1/matrix | Yes | Yes | Yes |
| POST /api/v1/selectors/resolve | Yes | Yes | Yes |
| PUT/DELETE /api/v1/.../tags/{tag} | No | Yes | Yes |
| GET /api/v1/.../tags | Yes | Yes | Yes |
| POST /api/v1/webhooks | No | No | Yes |
| GET /api/v1/webhooks | Yes | Yes | Yes |
| PUT/DELETE /api/v1/webhooks/{id} | No | No | Yes |
| POST /api/v1/cleanup | No | No | Yes |

## Error Cases
- 401: No credentials or invalid credentials
- 403: Valid credentials but insufficient role
