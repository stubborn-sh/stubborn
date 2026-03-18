#!/usr/bin/env bash
#
# Remove performance test data from the broker database.
# Deletes all applications whose names start with "perf-" (the naming convention
# used by the Gatling performance tests).
#
# Usage:
#   ./scripts/cleanup-perf-data.sh                       # default: http://localhost:8642
#   ./scripts/cleanup-perf-data.sh http://localhost:8080  # custom URL
#
set -euo pipefail

BROKER="${1:-http://localhost:8642}"
AUTH="admin:admin"

echo "==> Cleaning up performance test data from $BROKER"

# Fetch all applications, extract names starting with "perf-"
perf_apps=$(curl -s -u "$AUTH" "$BROKER/api/v1/applications?size=1000" \
  | python3 -c "
import json, sys
data = json.load(sys.stdin)
for app in data.get('content', []):
    name = app.get('name', '')
    if name.startswith('perf-'):
        print(name)
" 2>/dev/null)

if [[ -z "$perf_apps" ]]; then
  echo "  No performance test applications found."
  exit 0
fi

count=$(echo "$perf_apps" | wc -l | tr -d ' ')
echo "  Found $count perf-test application(s)."

for app in $perf_apps; do
  status=$(curl -s -o /dev/null -w "%{http_code}" -u "$AUTH" -X DELETE "$BROKER/api/v1/applications/$app")
  if [[ "$status" == "204" || "$status" == "200" ]]; then
    echo "  Deleted: $app"
  else
    echo "  WARN: Failed to delete $app (HTTP $status)"
  fi
done

echo "==> Cleanup complete."
