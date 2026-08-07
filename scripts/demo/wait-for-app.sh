#!/usr/bin/env bash
# Poll the deployed demo's health endpoint until it reports UP (or give up).
#
# After a Fly.io deploy, waits for ${DEMO_URL}/actuator/health to contain "UP" before the
# smoke test runs. Tries 30 times, 10s apart. Exits 0 as soon as it is UP, 1 if it never
# becomes ready.
#
# DEMO_URL is provided by the workflow environment.
#
# Usage: wait-for-app.sh
set -euo pipefail

DEMO_URL="${DEMO_URL:?DEMO_URL must be set}"

for i in $(seq 1 30); do
	if curl -sf "${DEMO_URL}/actuator/health" | grep -q "UP"; then
		echo "App is ready"
		exit 0
	fi
	echo "Waiting for app... attempt $i"
	sleep 10
done
echo "App did not become ready in time"
exit 1
