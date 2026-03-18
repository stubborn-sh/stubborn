#!/usr/bin/env bash
#
# Run Gatling performance tests against the broker.
#
# Usage:
#   ./perf-test.sh                    # defaults: 10 users, 60s, admin/admin
#   ./perf-test.sh --users 50 --duration 120
#   ./perf-test.sh --url http://remote:8080  # skip local broker start
#
set -euo pipefail

USERS=10
DURATION=60
BROKER_URL=""
BROKER_USER="admin"
BROKER_PASSWORD="admin"
SKIP_BUILD=false
BROKER_PID=""

usage() {
  cat <<EOF
Usage: $0 [OPTIONS]

Options:
  --users N          Number of virtual users (default: 10)
  --duration N       Test duration in seconds (default: 60)
  --url URL          Broker URL (skips local broker start)
  --user USER        Broker auth user (default: admin)
  --password PASS    Broker auth password (default: admin)
  --skip-build       Skip Maven build (use existing JARs)
  -h, --help         Show this help
EOF
  exit 0
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --users)     USERS="$2"; shift 2 ;;
    --duration)  DURATION="$2"; shift 2 ;;
    --url)       BROKER_URL="$2"; shift 2 ;;
    --user)      BROKER_USER="$2"; shift 2 ;;
    --password)  BROKER_PASSWORD="$2"; shift 2 ;;
    --skip-build) SKIP_BUILD=true; shift ;;
    -h|--help)   usage ;;
    *)           echo "Unknown option: $1"; usage ;;
  esac
done

cleanup() {
  if [[ -n "$BROKER_PID" ]]; then
    echo "Stopping broker (PID $BROKER_PID)..."
    kill "$BROKER_PID" 2>/dev/null || true
    wait "$BROKER_PID" 2>/dev/null || true
  fi
  if [[ -z "$BROKER_URL" ]]; then
    echo "Stopping PostgreSQL container..."
    docker compose -f broker-oss/broker/src/main/resources/compose.yaml stop postgres 2>/dev/null || true
  fi
}
trap cleanup EXIT

echo "=== Spring Cloud Contract Broker — Performance Tests ==="
echo "Users: $USERS | Duration: ${DURATION}s | Auth: $BROKER_USER"

# Step 1: Build if needed
if [[ "$SKIP_BUILD" == "false" ]]; then
  echo ""
  echo "--- Building broker JAR ---"
  ./mvnw clean install -DskipTests -DskipStubs=true -q
fi

# Step 2: Start broker locally if no URL provided
if [[ -z "$BROKER_URL" ]]; then
  BROKER_URL="http://localhost:8080"

  echo ""
  echo "--- Starting PostgreSQL ---"
  docker compose -f broker-oss/broker/src/main/resources/compose.yaml up -d postgres
  sleep 2

  echo ""
  echo "--- Starting broker ---"
  java -jar broker-oss/broker/target/spring-cloud-contract-broker-*.jar \
    --spring.datasource.url=jdbc:postgresql://localhost:5432/broker \
    --spring.datasource.username=broker \
    --spring.datasource.password=broker \
    --spring.docker.compose.enabled=false \
    --server.port=8080 > /tmp/broker-perf.log 2>&1 &
  BROKER_PID=$!
  echo "Broker PID: $BROKER_PID"

  echo "Waiting for broker to be ready..."
  for i in $(seq 1 60); do
    if curl -sf "$BROKER_URL/actuator/health" > /dev/null 2>&1; then
      echo "Broker ready after $((i * 2))s"
      break
    fi
    if ! kill -0 "$BROKER_PID" 2>/dev/null; then
      echo "ERROR: Broker process died. Check /tmp/broker-perf.log"
      tail -50 /tmp/broker-perf.log
      exit 1
    fi
    sleep 2
  done

  if ! curl -sf "$BROKER_URL/actuator/health" > /dev/null 2>&1; then
    echo "ERROR: Broker failed to start within 120s"
    tail -50 /tmp/broker-perf.log
    exit 1
  fi
fi

echo ""
echo "--- Running Gatling performance tests ---"
echo "Target: $BROKER_URL"

./mvnw verify -Pperformance -pl perf-tests \
  -Dbroker.url="$BROKER_URL" \
  -Dbroker.user="$BROKER_USER" \
  -Dbroker.password="$BROKER_PASSWORD" \
  -Dperf.users="$USERS" \
  -Dperf.duration="$DURATION"

# Step 3: Print summary
REPORT_DIR=$(find perf-tests/target/gatling -maxdepth 1 -mindepth 1 -type d -name "brokersimulation-*" | sort | tail -1)
if [[ -n "$REPORT_DIR" ]]; then
  echo ""
  echo "=== Performance Test Complete ==="
  echo "Report: file://$REPORT_DIR/index.html"
  echo ""
  if [[ -f "$REPORT_DIR/js/stats.json" ]]; then
    echo "--- Summary (from stats.json) ---"
    python3 -c "
import json, sys
with open('$REPORT_DIR/js/stats.json') as f:
    data = json.load(f)
stats = data['stats']
print(f\"Total requests:  {stats['numberOfRequests']['total']:,}\")
print(f\"OK requests:     {stats['numberOfRequests']['ok']:,}\")
print(f\"KO requests:     {stats['numberOfRequests']['ko']:,}\")
print(f\"Mean resp time:  {stats['meanResponseTime']['total']}ms\")
print(f\"p50 resp time:   {stats['percentiles1']['total']}ms\")
print(f\"p75 resp time:   {stats['percentiles2']['total']}ms\")
print(f\"p95 resp time:   {stats['percentiles3']['total']}ms\")
print(f\"p99 resp time:   {stats['percentiles4']['total']}ms\")
print(f\"Max resp time:   {stats['maxResponseTime']['total']}ms\")
print(f\"Mean throughput:  {stats['meanNumberOfRequestsPerSecond']['total']:.1f} req/s\")
print()
for name, group in data.get('contents', {}).items():
    s = group['stats']
    ok = s['numberOfRequests']['ok']
    ko = s['numberOfRequests']['ko']
    total = ok + ko
    pct = (ok / total * 100) if total > 0 else 0
    print(f\"  {s['name']:<25} OK: {ok:>8,} / {total:>8,} ({pct:5.1f}%)  p95: {s['percentiles3']['total']}ms\")
" 2>/dev/null || echo "(install python3 for detailed summary)"
  fi
fi
