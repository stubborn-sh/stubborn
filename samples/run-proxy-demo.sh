#!/usr/bin/env bash
#
# Run the proxy-based AI contract generation demo.
#
# Prerequisites:
#   - Docker and Docker Compose installed
#   - OPENAI_API_KEY environment variable set
#   - Broker and proxy images built (./mvnw clean install -T 1C)
#
# Usage:
#   ./samples/run-proxy-demo.sh
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "=== Spring Cloud Contract Broker — Proxy Demo ==="
echo ""

# 1. Validate prerequisites
if [[ -z "${OPENAI_API_KEY:-}" ]]; then
  echo "ERROR: OPENAI_API_KEY environment variable is not set."
  echo "  export OPENAI_API_KEY=sk-..."
  exit 1
fi

if ! command -v docker &>/dev/null; then
  echo "ERROR: docker is not installed."
  exit 1
fi

# 2. Start broker + proxy via Docker Compose
echo "[1/5] Starting broker and proxy containers..."
cd "$PROJECT_ROOT"
docker compose --profile proxy up -d --wait 2>/dev/null || docker-compose --profile proxy up -d 2>/dev/null
echo "  Broker:  http://localhost:18080"
echo "  Proxy:   http://localhost:18081"
echo ""

# Wait for broker to be ready
echo "[2/5] Waiting for broker to be ready..."
for i in $(seq 1 30); do
  if curl -sf http://localhost:18080/actuator/health > /dev/null 2>&1; then
    echo "  Broker is ready."
    break
  fi
  if [[ $i -eq 30 ]]; then
    echo "ERROR: Broker did not start within 30 seconds."
    docker compose --profile proxy logs
    exit 1
  fi
  sleep 1
done
echo ""

# 3. Run proxy producer tests (sends traffic through proxy)
echo "[3/5] Sending traffic through AI proxy (proxy-producer)..."
cd "$PROJECT_ROOT/samples/proxy-producer"
../../mvnw -q failsafe:integration-test failsafe:verify -Dmaven.surefire.skip=true -Dfailsafe.skip=false \
  -Dproxy.url=http://localhost:18081 2>&1 || echo "  (Producer tests completed — check output above)"
echo ""

# 4. Query broker for generated contracts
echo "[4/5] Querying broker for AI-generated contracts..."
echo ""
echo "  Applications:"
curl -sf -u admin:admin http://localhost:18080/api/v1/applications | python3 -m json.tool 2>/dev/null || \
  curl -sf -u admin:admin http://localhost:18080/api/v1/applications
echo ""
echo ""

# 5. Run consumer validation tests
echo "[5/5] Validating contracts in broker (proxy-consumer)..."
cd "$PROJECT_ROOT/samples/proxy-consumer"
../../mvnw -q failsafe:integration-test failsafe:verify -Dmaven.surefire.skip=true -Dfailsafe.skip=false \
  -Dbroker.url=http://localhost:18080 2>&1 || echo "  (Consumer validation completed — check output above)"
echo ""

# Cleanup
echo "=== Demo Complete ==="
echo ""
echo "Containers are still running. To stop them:"
echo "  cd $PROJECT_ROOT && docker compose --profile proxy down"
echo ""
echo "To view the UI: http://localhost:18080 (admin/admin)"
