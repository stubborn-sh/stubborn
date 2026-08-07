#!/usr/bin/env bash
# Start the broker JAR in the background and block until its health endpoint responds.
#
# Boots the packaged broker against the workflow's Postgres service and polls
# /actuator/health once a second for up to 60s, so the load-test steps only run once the
# broker is actually serving. Fails (exit 1) if it never comes up.
#
# Test seam: BROKER_PORT / HEALTH_URL default to the values the load-test workflow uses,
# so a test can point the health check at a stub without changing CI behavior.
#
# Usage: start-broker.sh   (run from the repository root)
set -euo pipefail

BROKER_PORT="${BROKER_PORT:-8642}"
HEALTH_URL="${HEALTH_URL:-http://localhost:${BROKER_PORT}/actuator/health}"

java -jar broker/target/stubborn-broker-*-exec.jar \
	--spring.datasource.url=jdbc:postgresql://localhost:5432/broker \
	--spring.datasource.username=broker \
	--spring.datasource.password=broker \
	--spring.docker.compose.enabled=false \
	--server.port="${BROKER_PORT}" &
echo "Waiting for broker to start..."
for i in $(seq 1 60); do
	if curl -sf "${HEALTH_URL}" > /dev/null 2>&1; then
		echo "Broker is ready"
		break
	fi
	if [ "$i" -eq 60 ]; then
		echo "Broker failed to start within 60 seconds"
		exit 1
	fi
	sleep 1
done
