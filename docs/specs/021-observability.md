# Cross-Cutting: Observability

## What

The broker exposes health checks, metrics, and distributed tracing to support production
monitoring and debugging. Operations teams can observe the broker's health, track business
activity, and correlate requests across services.

## Why

A governance server that other services depend on for deployment safety must be observable:
- Health checks enable Kubernetes liveness/readiness probes
- Metrics track business activity (contracts published, verifications recorded, webhooks delivered)
- Distributed tracing correlates requests across the broker, MCP server, and calling services
- Without observability, operators cannot detect or diagnose issues before they affect deployments

## Health Checks

The broker exposes health endpoints for orchestration platforms:

| Endpoint | Purpose |
|----------|---------|
| `/actuator/health/liveness` | Is the process alive? |
| `/actuator/health/readiness` | Can the process accept traffic? (DB connected, etc.) |

Health endpoints are public (no authentication required). All other actuator endpoints
are disabled or restricted.

## Metrics

Business-critical operations emit metrics:

| Metric Category | Examples |
|-----------------|----------|
| **Application management** | Registrations, deletions |
| **Contract publishing** | Contracts published, by content type |
| **Verification recording** | Verifications recorded, success/failure ratio |
| **Deployment tracking** | Deployments recorded, by environment |
| **Webhook delivery** | Deliveries attempted, succeeded, failed, retried |
| **Can-I-Deploy checks** | Checks performed, safe/unsafe ratio |
| **Data cleanup** | Versions deleted, contracts cleaned |

Each metric includes latency (how long the operation took) and error rate. Metrics use
low-cardinality tags to prevent unbounded growth in time-series databases.

## Distributed Tracing

All API requests include trace context propagation. Trace IDs appear in:
- HTTP response headers
- Application logs
- Error responses (`traceId` field)

This enables correlating a failed can-i-deploy check back to the verification and contract
publishing operations that produced the data.

## Caching

Frequently accessed read-only data is cached to reduce database load:

| Cached Data | Invalidation |
|-------------|-------------|
| Application lookups | On application create/delete |
| Dependency graph | On new verification recorded |

Caches are bounded (maximum entry count) to prevent memory exhaustion. Cache hit/miss
metrics are exposed for monitoring.

## Logging

Structured logs with trace context. Sensitive data (credentials, tokens) is never logged.
Business events (application registered, contract published, verification recorded) are
logged at INFO level. Errors include relevant IDs for debugging (application name, version,
verification ID).
