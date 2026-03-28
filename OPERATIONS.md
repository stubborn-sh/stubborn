# Stubborn Broker -- Operations Guide

## Architecture Overview

```
┌─────────┐     ┌───────────────────┐     ┌──────────────┐
│  Users   │────>│   Load Balancer   │────>│  Broker (N)  │
│  CLI/UI  │     │  (Ingress/nginx)  │     │  Spring Boot │
└─────────┘     └───────────────────┘     └──────┬───────┘
                                                  │
                    ┌─────────────────────────────┤
                    │                             │
              ┌─────▼──────┐              ┌───────▼────────┐
              │ PostgreSQL  │              │  OTLP Collector │
              │  (Primary)  │              │  -> Prometheus  │
              └─────────────┘              │  -> Loki / Tempo│
                                           └────────────────┘
```

The broker is a stateless Spring Boot application. Multiple replicas sit behind a
load balancer; all state lives in PostgreSQL. Observability data flows through an
OpenTelemetry Collector into the LGTM stack (Loki, Grafana, Tempo, Mimir/Prometheus).

---

## 1. Deployment

### Helm (production)

```bash
# Add the chart repo (or use the local chart in charts/stubborn-broker)
helm repo add stubborn https://charts.stubborn.sh
helm repo update

# Install with sensible defaults
helm install stubborn-broker stubborn/stubborn-broker \
  --namespace stubborn --create-namespace \
  -f values-prod.yaml

# Upgrade
helm upgrade stubborn-broker stubborn/stubborn-broker \
  --namespace stubborn -f values-prod.yaml
```

Key `values.yaml` overrides for production:

| Parameter | Recommended | Why |
|-----------|-------------|-----|
| `replicaCount` | 2+ | High availability |
| `autoscaling.enabled` | `true` | Respond to load spikes |
| `autoscaling.targetCPUUtilizationPercentage` | 70 | Scale before saturation |
| `resources.requests.memory` | `256Mi` | Baseline for JVM |
| `resources.limits.memory` | `512Mi` | Prevent OOM on host |
| `postgresql.existingSecret` | set to a pre-created Secret name | Never store passwords in values.yaml |
| `ingress.enabled` | `true` | Expose the service externally |
| `ingress.tls` | configure | Enforce HTTPS |

### Docker Compose (development)

```bash
# From the repo root
docker compose up -d          # starts broker + PostgreSQL + OTLP stack
docker compose logs -f broker # tail broker logs
docker compose down           # stop everything
```

The `compose.yaml` in the repo root provides:
- PostgreSQL 16 on port 5432
- The broker on port 8642
- Optional LGTM stack (Grafana on 3000, Prometheus on 9090)

---

## 2. Scaling

### Horizontal Pod Autoscaler

The Helm chart includes an HPA template (`templates/hpa.yaml`). Enable it in
`values.yaml`:

```yaml
autoscaling:
  enabled: true
  minReplicas: 2
  maxReplicas: 5
  targetCPUUtilizationPercentage: 70
```

**When to scale:**
- CPU consistently above 70% for 2+ minutes.
- P95 latency exceeds 1 second.
- Connection pool utilization above 80%.

**Scaling limits:**
- Each replica needs ~256 Mi memory at idle, up to 512 Mi under load.
- Each replica holds up to 30 database connections (HikariCP `maximum-pool-size`).
- With 5 replicas you consume up to 150 connections; size PostgreSQL
  `max_connections` accordingly (recommend 200+).

### Connection Pool Sizing

The broker uses HikariCP with the following defaults (see `application.yaml`):

| Setting | Value | Notes |
|---------|-------|-------|
| `maximum-pool-size` | 30 | Max connections per pod |
| `minimum-idle` | 5 | Kept warm for burst traffic |
| `connection-timeout` | 20 000 ms | Fail fast if pool exhausted |
| `idle-timeout` | 300 000 ms (5 min) | Release idle connections |
| `max-lifetime` | 1 200 000 ms (20 min) | Rotate before PG timeout |

Formula: `max_connections (PG) >= maxReplicas * maximum-pool-size + headroom`

---

## 3. Health Checks

The broker exposes Spring Boot Actuator health probes:

| Endpoint | K8s Probe | Meaning |
|----------|-----------|---------|
| `/actuator/health/liveness` | livenessProbe | JVM is alive. Failure triggers pod restart. |
| `/actuator/health/readiness` | readinessProbe | App can serve traffic (DB connected, Flyway done). Failure removes pod from Service. |
| `/actuator/health` | General | Composite of all health indicators. |

### Interpreting `/actuator/health`

- **UP** -- all subsystems healthy.
- **DOWN** -- at least one critical indicator failed (database, disk space).
- **OUT_OF_SERVICE** -- application is shutting down gracefully.

### Probe Configuration (in Helm)

The deployment template configures:
- **startupProbe**: 10 s initial delay, checks every 5 s, tolerates 30 failures
  (up to 160 s for slow cold starts with Flyway migrations).
- **livenessProbe**: every 10 s, 3 failures before restart.
- **readinessProbe**: every 5 s, 3 failures before traffic removal.

---

## 4. Database

### Backup Strategy

| Property | Target |
|----------|--------|
| **Method** | Automated daily snapshots (pg_dump or cloud-native snapshots) |
| **Retention** | 30 days |
| **RTO** | <= 4 hours |
| **RPO** | <= 1 hour |

#### Daily Snapshot (pg_dump)

```bash
# Cron: 0 2 * * * (daily at 02:00 UTC)
pg_dump -Fc -h $PG_HOST -U broker -d broker \
  | gzip > /backups/broker-$(date +%Y%m%d-%H%M%S).dump.gz

# Clean up backups older than 30 days
find /backups -name "broker-*.dump.gz" -mtime +30 -delete
```

For cloud-managed PostgreSQL (RDS, Cloud SQL, Azure Flexible Server), enable
automated backups with 30-day retention and point-in-time recovery.

#### WAL Archiving (RPO <= 1 hour)

Enable continuous WAL archiving to an object store (S3, GCS) so you can restore
to any point within the last hour.

```
# postgresql.conf
archive_mode = on
archive_command = 'pgbackrest --stanza=broker archive-push %p'
```

#### Restore Procedure

1. **Stop** broker replicas: `kubectl scale deployment stubborn-broker --replicas=0`
2. **Restore** from the latest dump:
   ```bash
   pg_restore -Fc -h $PG_HOST -U broker -d broker --clean /backups/broker-latest.dump.gz
   ```
   Or use point-in-time recovery via WAL:
   ```bash
   pgbackrest --stanza=broker --type=time \
     --target="2026-03-28 12:00:00+00" restore
   ```
3. **Validate** data integrity: run a smoke test query.
4. **Scale back up**: `kubectl scale deployment stubborn-broker --replicas=2`
5. **Verify** health: `curl https://broker.example.com/actuator/health`

---

## 5. Credentials

### Encryption Key

The broker encrypts sensitive contract metadata at rest using an AES-256 key.

```bash
# Generate a new key
openssl rand -base64 32

# Set via environment variable
export BROKER_CREDENTIALS_ENCRYPTION_KEY=<base64-key>

# Or via Kubernetes Secret
kubectl create secret generic stubborn-encryption \
  --from-literal=encryption-key=<base64-key>
```

In `application.yaml` this maps to `broker.credentials.encryption-key`.
An empty value disables encryption (development mode only).

### Rotate Database Password

1. Update the password in PostgreSQL:
   ```sql
   ALTER USER broker WITH PASSWORD 'new-password';
   ```
2. Update the Kubernetes Secret:
   ```bash
   kubectl create secret generic stubborn-broker \
     --from-literal=db-username=broker \
     --from-literal=db-password=new-password \
     --dry-run=client -o yaml | kubectl apply -f -
   ```
3. Rolling-restart the broker pods:
   ```bash
   kubectl rollout restart deployment stubborn-broker
   ```
4. Verify connectivity via `/actuator/health`.

### Configure OAuth2

Set the following environment variables (or Helm values) for OAuth2-based
authentication:

```yaml
spring:
  security:
    oauth2:
      resourceserver:
        jwt:
          issuer-uri: https://auth.example.com/realms/stubborn
```

---

## 6. Monitoring

### Prometheus Metrics

The broker exposes a Prometheus scrape endpoint at `/actuator/prometheus`
(enabled by setting `PROMETHEUS_ENABLED=true`).

Key metrics to watch:

| Metric | Description | Alert Threshold |
|--------|-------------|-----------------|
| `http_server_requests_seconds_count{status=~"5.."}` | 5xx error rate | > 0.01/s for 5 min |
| `http_server_requests_seconds_bucket` | Request latency histogram | P95 > 1 s |
| `hikaricp_connections_active` | Active DB connections | > 90% of max |
| `resilience4j_circuitbreaker_state` | Circuit breaker state | state=open |
| `jvm_memory_used_bytes` | JVM heap usage | > 80% of limit |
| `process_cpu_usage` | CPU usage | > 70% sustained |

### Grafana Dashboard

Import the Stubborn Broker dashboard:

1. Open Grafana -> Dashboards -> Import.
2. Upload `docs/grafana/stubborn-broker-dashboard.json` (or use the dashboard ID
   from the Grafana marketplace once published).
3. Select your Prometheus data source.

### LGTM Stack

The recommended observability stack:

- **Loki** -- log aggregation (structured JSON logs from the broker)
- **Grafana** -- dashboards and alerting
- **Tempo** -- distributed tracing (via OTLP)
- **Mimir / Prometheus** -- metrics storage

Configure the broker's OTLP endpoint:

```yaml
management:
  otlp:
    tracing:
      endpoint: http://otel-collector:4318/v1/traces
    metrics:
      export:
        enabled: true
        url: http://otel-collector:4318/v1/metrics
```

### Alerting Rules

PrometheusRule alerts are deployed via the Helm chart when the PrometheusRule CRD
is available. See `charts/stubborn-broker/templates/prometheusrule.yaml` for the
full set of rules:

- **HighErrorRate** (critical) -- 5xx rate > 0.01/s for 5 min
- **CircuitBreakerOpen** (warning) -- any circuit breaker in open state for 1 min
- **HighLatency** (warning) -- P95 > 1 s for 5 min
- **DatabaseConnectionPoolExhausted** (critical) -- active connections > 90% of max for 2 min

---

## 7. Troubleshooting

### Circuit Breaker Open

**Symptoms:** 503 responses, `resilience4j_circuitbreaker_state{state="open"} == 1`.

**Diagnosis:**
```bash
# Check which circuit breaker is open
curl -s http://broker:8642/actuator/circuitbreakers | jq .
```

**Root causes:** downstream service unavailable (database, webhook target, Git/Maven repo).

**Recovery:**
1. Fix the underlying issue (restore DB connectivity, fix webhook endpoint).
2. The circuit breaker will auto-transition to half-open after 30 s (configurable).
3. If urgent, restart the pod: `kubectl delete pod <pod-name>`.

See `INCIDENTS.md` for the full playbook.

### Database Unreachable

**Symptoms:** readiness probe fails, `/actuator/health` shows `db: DOWN`.

**Quick checks:**
```bash
# Is PostgreSQL running?
kubectl get pods -l app=postgresql

# Can the broker reach it?
kubectl exec -it <broker-pod> -- nc -zv postgresql 5432

# Check connection pool
curl -s http://broker:8642/actuator/metrics/hikaricp.connections.active | jq .
```

See `INCIDENTS.md` for the full playbook.

### Webhook Delivery Failures

**Symptoms:** webhook circuit breaker open, events stuck in retry queue.

**Quick checks:**
```bash
# Check webhook circuit breaker
curl -s http://broker:8642/actuator/circuitbreakers | jq '.circuitBreakers.webhookDispatch'

# Check logs for timeout details
kubectl logs -l app.kubernetes.io/name=stubborn-broker --tail=100 | grep -i webhook
```

See `INCIDENTS.md` for the full playbook.
