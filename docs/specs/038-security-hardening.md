# Spec 038 — Security Hardening

## Problem

The broker API lacks production-grade security hardening: no rate limiting, no request size limits, no CORS policy, no security response headers, default credentials active in all profiles, and no enforcement of encryption key in production.

## Solution

Apply defense-in-depth measures across the broker's HTTP layer, authentication configuration, and credential encryption.

## Design

### Rate Limiting

- Resilience4j `RateLimiter` applied via a servlet filter (`RateLimitFilter`) to all requests
- Configured as `api` instance: 100 requests/second, 0s timeout (fail-fast)
- Returns `429 Too Many Requests` with JSON error body when exceeded

### Request Body Size Limit

- Tomcat `max-http-post-size` set to 10MB (10485760 bytes)
- Prevents memory exhaustion from oversized POST bodies

### Contract Content Size Validation

- `@Size(max = 1048576)` on `CreateContractRequest.content` (1MB)
- Returns `400 Bad Request` with `VALIDATION_ERROR` code

### Pagination Max Size

- `spring.data.web.pageable.max-page-size` set to 1000
- Prevents clients from requesting unbounded result sets

### CORS Configuration

- Explicit allowed origins: `https://stubborn.sh`, `http://localhost:5173`
- Allowed methods: GET, POST, PUT, DELETE
- All headers allowed
- Requests from unlisted origins receive no `Access-Control-Allow-Origin` header

### Security Headers

| Header | Value | Purpose |
|--------|-------|---------|
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` | Force HTTPS |
| `Content-Security-Policy` | `default-src 'self'; script-src 'self'` | Prevent XSS |
| `X-Frame-Options` | `DENY` | Prevent clickjacking |

### Default Credentials Scoped to Non-Production

- `UserConfig` annotated with `@Profile("!production")`
- Production deployments must configure LDAP/OAuth2/OIDC

### Encryption Key Mandatory in Production

- `CredentialEncryptionService` throws `IllegalStateException` at startup if `broker.credentials.encryption-key` is empty and the `production` profile is active

### Error Response Hardening

- `server.error.include-stacktrace: never` — no stack traces in error responses
- `server.error.include-message: never` — no exception messages in default error responses

## Acceptance Criteria

- [ ] Rate limiter returns 429 when requests exceed configured limit
- [ ] Tomcat max POST size is 10MB
- [ ] Contract content exceeding 1MB is rejected with 400
- [ ] Page size requests exceeding 1000 are capped at 1000
- [ ] CORS allows `https://stubborn.sh` and `http://localhost:5173`
- [ ] CORS rejects unlisted origins
- [ ] `X-Frame-Options: DENY` header present in responses
- [ ] `Content-Security-Policy` header present in responses
- [ ] `Strict-Transport-Security` header present in responses
- [ ] Default credentials disabled when `production` profile is active
- [ ] Application fails to start in `production` profile without encryption key
- [ ] Stack traces not included in error responses
