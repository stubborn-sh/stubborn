# Stubborn Broker -- Incident Playbooks

Each playbook follows the structure: **Detect -> Diagnose -> Resolve -> Verify -> Post-mortem**.

---

## 1. Database Unreachable

### Detection
- Alert: readiness probe failures, `/actuator/health` returns `db: DOWN`.
- Alert: `DatabaseConnectionPoolExhausted` fires.
- Logs: `HikariPool - Connection is not available, request timed out`.

### Diagnosis

```bash
# 1. Check PostgreSQL pod/service status
kubectl get pods -l app=postgresql -n stubborn
kubectl describe svc postgresql -n stubborn

# 2. Test network connectivity from a broker pod
kubectl exec -it <broker-pod> -n stubborn -- nc -zv postgresql 5432

# 3. Check PostgreSQL logs
kubectl logs -l app=postgresql -n stubborn --tail=200

# 4. Check connection pool metrics
curl -s http://broker:8642/actuator/metrics/hikaricp.connections.active | jq .
curl -s http://broker:8642/actuator/metrics/hikaricp.connections.pending | jq .

# 5. Check if max_connections is exhausted on PG side
kubectl exec -it <pg-pod> -- psql -U broker -c "SELECT count(*) FROM pg_stat_activity;"
```

### Common Causes
- PostgreSQL pod crashed or was evicted (check events).
- Network policy blocking traffic between namespaces.
- `max_connections` exceeded on PG side (too many broker replicas).
- DNS resolution failure for the PostgreSQL service.

### Resolution

1. **PG pod down**: check PVC status, restart the StatefulSet.
   ```bash
   kubectl rollout restart statefulset postgresql -n stubborn
   ```
2. **max_connections exhausted**: reduce `maximum-pool-size` per broker or increase
   PG `max_connections`.
3. **Network policy**: verify policies allow traffic from the broker namespace to PG.

### Circuit Breaker Reset

The `database` circuit breaker auto-transitions to half-open after 30 s. If you
need immediate recovery after fixing the issue:

```bash
kubectl delete pod -l app.kubernetes.io/name=stubborn-broker -n stubborn
```

### Verify

```bash
curl -s http://broker:8642/actuator/health | jq '.components.db'
# Expected: {"status":"UP"}
```

---

## 2. High Latency

### Detection
- Alert: `HighLatency` -- P95 response time > 1 s for 5 min.
- Grafana dashboard shows elevated latency on specific endpoints.

### Diagnosis

```bash
# 1. Identify slow endpoints
curl -s http://broker:8642/actuator/metrics/http.server.requests \
  | jq '.availableTags[] | select(.tag=="uri") | .values'

# 2. Check per-endpoint latency
curl -s 'http://broker:8642/actuator/metrics/http.server.requests?tag=uri:/api/contracts' | jq .

# 3. Check CPU and memory pressure
kubectl top pods -l app.kubernetes.io/name=stubborn-broker -n stubborn

# 4. Check database slow queries
kubectl exec -it <pg-pod> -- psql -U broker -c \
  "SELECT pid, now() - pg_stat_activity.query_start AS duration, query
   FROM pg_stat_activity WHERE state = 'active' ORDER BY duration DESC LIMIT 10;"

# 5. Check GC pressure
kubectl logs <broker-pod> -n stubborn | grep -i "gc pause"

# 6. Check trace data in Tempo/Jaeger for specific slow requests
```

### Scaling Decision Tree

1. **CPU > 70%?** -> Scale horizontally (increase HPA maxReplicas or lower target CPU%).
2. **DB queries slow?** -> Add indexes, optimize queries, consider read replicas.
3. **GC pauses?** -> Increase memory limits, tune `-XX:MaxRAMPercentage`.
4. **Single endpoint slow?** -> Profile that code path; check for N+1 queries.

### Slow Query Analysis

```sql
-- Enable pg_stat_statements if not already
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Top 10 slowest queries by mean time
SELECT query, calls, mean_exec_time, total_exec_time
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;
```

### Resolution

1. Scale up if CPU-bound.
2. Add missing indexes if query-bound.
3. Increase connection pool if waiting on connections.
4. Consider caching for read-heavy endpoints.

### Verify

Monitor P95 latency in Grafana; confirm alert resolves within 5 min.

---

## 3. Circuit Breaker Open

### Detection
- Alert: `CircuitBreakerOpen` -- `resilience4j_circuitbreaker_state{state="open"} == 1`.
- HTTP 503 responses from the broker.

### Diagnosis

```bash
# 1. Which circuit breaker is open?
curl -s http://broker:8642/actuator/circuitbreakers | jq .

# 2. Check failure rate and slow call rate
curl -s http://broker:8642/actuator/circuitbreakerevents | jq '.circuitBreakerEvents[-10:]'

# 3. Check logs for the underlying failure
kubectl logs -l app.kubernetes.io/name=stubborn-broker -n stubborn --tail=200 \
  | grep -E "CircuitBreaker|exception|ERROR"
```

### Root Cause by Circuit Breaker

| Circuit Breaker | Likely Cause | First Check |
|-----------------|--------------|-------------|
| `database` | PG down or unreachable | See Playbook 1 |
| `webhookDispatch` | Webhook endpoint down or slow | Check target URL reachability |
| `mavenImport` | Maven Central / private repo down | Check repo URL |
| `gitImport` | Git server unreachable or auth failure | Check SSH keys / tokens |

### Resolution

1. Fix the underlying dependency.
2. Wait for auto-transition to half-open (30 s default).
3. Half-open state allows 3 trial calls; if they succeed, the breaker closes.
4. **Emergency reset**: delete the affected pod(s) to force a fresh breaker state.

### Manual Reset (if Actuator endpoint is enabled)

```bash
# Requires circuitbreakers endpoint exposed (management.endpoints.web.exposure.include)
curl -X POST http://broker:8642/actuator/circuitbreakers/<name>/reset
```

### Verify

```bash
curl -s http://broker:8642/actuator/circuitbreakers | jq '.circuitBreakers.<name>.state'
# Expected: "CLOSED"
```

---

## 4. Pod Crashes

### Detection
- `kubectl get pods` shows `CrashLoopBackOff` or high restart count.
- Alerts from Kubernetes events.

### Diagnosis

```bash
# 1. Check pod status and restart count
kubectl get pods -l app.kubernetes.io/name=stubborn-broker -n stubborn

# 2. Check events for the pod
kubectl describe pod <pod-name> -n stubborn

# 3. Check logs from the previous crash
kubectl logs <pod-name> -n stubborn --previous --tail=200

# 4. Check if OOMKilled
kubectl get pod <pod-name> -n stubborn -o jsonpath='{.status.containerStatuses[0].lastState.terminated.reason}'
# "OOMKilled" means the container exceeded its memory limit
```

### OOM Detection and Resolution

If the termination reason is `OOMKilled`:

1. **Check current limits**: `kubectl get pod <pod-name> -o jsonpath='{.spec.containers[0].resources.limits.memory}'`
2. **Increase memory limit** in `values.yaml`:
   ```yaml
   resources:
     limits:
       memory: 1Gi   # increase from 512Mi
   ```
3. **Tune JVM**: ensure `-XX:MaxRAMPercentage=75.0` leaves room for off-heap memory.
4. **Investigate leak**: if OOMs recur, capture a heap dump:
   ```bash
   kubectl exec <pod> -- jcmd 1 GC.heap_dump /tmp/heap.hprof
   kubectl cp <pod>:/tmp/heap.hprof ./heap.hprof
   ```

### Application Crash (non-OOM)

1. Check `--previous` logs for stack traces.
2. Common causes:
   - Flyway migration failure (schema mismatch).
   - Missing required environment variables.
   - SSL/TLS certificate errors connecting to PG.
3. Fix the root cause, then delete the failing pod.

### Restart Procedures

```bash
# Single pod restart
kubectl delete pod <pod-name> -n stubborn

# Full rolling restart
kubectl rollout restart deployment stubborn-broker -n stubborn

# Watch rollout progress
kubectl rollout status deployment stubborn-broker -n stubborn
```

### Verify

```bash
kubectl get pods -l app.kubernetes.io/name=stubborn-broker -n stubborn
# All pods should be Running with 0 restarts
```

---

## 5. Webhook Delivery Failures

### Detection
- Alert: `CircuitBreakerOpen` with breaker name `webhookDispatch`.
- Logs: timeout or connection refused errors when sending webhooks.

### Diagnosis

```bash
# 1. Check webhook circuit breaker state
curl -s http://broker:8642/actuator/circuitbreakers \
  | jq '.circuitBreakers.webhookDispatch'

# 2. Check recent webhook events
curl -s http://broker:8642/actuator/circuitbreakerevents \
  | jq '.circuitBreakerEvents[] | select(.circuitBreakerName=="webhookDispatch")'

# 3. Check logs for webhook errors
kubectl logs -l app.kubernetes.io/name=stubborn-broker -n stubborn --tail=200 \
  | grep -i webhook

# 4. Test webhook endpoint reachability from broker pod
kubectl exec -it <broker-pod> -- curl -v https://target-webhook-url/endpoint
```

### Timeout Investigation

The webhook circuit breaker has a slow-call threshold of 10 s. If the target
endpoint is slow:

1. Check the target service's health.
2. Check DNS resolution from the broker pod.
3. Check if there's a proxy or firewall in the path.
4. Check for TLS handshake issues.

### Retry Backlog

If the broker has accumulated a retry backlog:

1. Check queue depth in logs or metrics.
2. Fix the target endpoint first.
3. The broker will drain the retry queue automatically once the circuit breaker
   closes.
4. If the backlog is too large, consider manually purging stale events from the
   database:
   ```sql
   -- Check pending webhook events
   SELECT count(*), status FROM webhook_events GROUP BY status;

   -- Purge events older than 7 days that are still pending
   DELETE FROM webhook_events
   WHERE status = 'PENDING' AND created_at < now() - interval '7 days';
   ```

### Verify

```bash
curl -s http://broker:8642/actuator/circuitbreakers \
  | jq '.circuitBreakers.webhookDispatch.state'
# Expected: "CLOSED"
```

---

## 6. Import Failures

### Detection
- Alert: `CircuitBreakerOpen` with breaker name `gitImport` or `mavenImport`.
- User reports: contract import from Git or Maven fails.

### Git Clone Timeout

```bash
# 1. Check gitImport circuit breaker
curl -s http://broker:8642/actuator/circuitbreakers \
  | jq '.circuitBreakers.gitImport'

# 2. Test Git connectivity from broker pod
kubectl exec -it <broker-pod> -- git ls-remote https://github.com/org/repo.git

# 3. Check for SSH key issues (if using SSH)
kubectl exec -it <broker-pod> -- ssh -T git@github.com

# 4. Check for proxy/firewall blocking Git traffic
kubectl exec -it <broker-pod> -- nc -zv github.com 443
```

**Common causes:**
- Git server unreachable or rate-limited.
- Authentication token expired.
- Repository is very large (consider shallow clone).
- Network policy blocking egress.

**Resolution:**
1. Verify/refresh authentication tokens.
2. Check network egress rules.
3. If rate-limited, wait for the rate limit to reset or use a deploy key.

### Maven Download Failures

```bash
# 1. Check mavenImport circuit breaker
curl -s http://broker:8642/actuator/circuitbreakers \
  | jq '.circuitBreakers.mavenImport'

# 2. Test Maven repository connectivity
kubectl exec -it <broker-pod> -- curl -v https://repo1.maven.org/maven2/

# 3. If using a private repo (Artifactory, Nexus), check its health
kubectl exec -it <broker-pod> -- curl -v https://nexus.internal/repository/maven-central/
```

**Common causes:**
- Maven Central or private repository unreachable.
- Artifact does not exist at the specified coordinates.
- Proxy/firewall blocking Maven repository access.
- Authentication to private repository expired.

**Resolution:**
1. Verify repository URL and credentials.
2. Check egress network policies.
3. If using a mirror, verify the mirror is synced.

### Verify

```bash
# Trigger a test import and check the result
curl -s http://broker:8642/actuator/circuitbreakers | jq '.circuitBreakers.gitImport.state'
curl -s http://broker:8642/actuator/circuitbreakers | jq '.circuitBreakers.mavenImport.state'
# Expected: "CLOSED"
```
