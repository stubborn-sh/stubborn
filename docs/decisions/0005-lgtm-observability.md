# ADR 0005: LGTM Observability Stack

## Status

Accepted

## Context

The broker needs production-grade observability (metrics, traces, logs) with a
developer-friendly local setup.

## Decision

Use the **LGTM stack** (Loki, Grafana, Tempo, Prometheus) via the
`grafana/otel-lgtm` all-in-one Docker image for dev mode, with OTLP export
for production.

- `spring-boot-starter-actuator` + `micrometer-tracing-bridge-otel` for traces
- `micrometer-registry-prometheus` for metrics
- `loki-logback-appender` for structured log shipping
- `context-propagation` for async/virtual thread trace context
- `datasource-micrometer` for JDBC observation
- Dev mode: Docker Compose auto-provisions LGTM container
- Prod mode: OTLP export to external observability platform

## Consequences

- **Positive**: Full observability (metrics, traces, logs) in a single container for dev
- **Positive**: Grafana dashboards with exemplar navigation (metrics -> traces)
- **Positive**: OTLP is vendor-neutral — works with any OTLP-compatible backend
- **Positive**: Business metrics via Observation API integrate with all three signals
- **Negative**: grafana/otel-lgtm is not suitable for production (single container)
- **Negative**: Requires Docker for dev mode observability
