#!/usr/bin/env bash
# Assert that a rendered Helm manifest contains every resource kind the chart must emit.
#
# Reads `helm template` output on stdin and fails (exit 1) if any of the required kinds
# is missing, so a chart change that silently drops the Deployment / Service / ConfigMap
# / ServiceAccount is caught in CI.
#
# Usage: helm template ... | verify-helm-resources.sh
set -euo pipefail

OUTPUT="$(cat)"

echo "$OUTPUT" | grep -q "kind: Deployment" || { echo "Missing Deployment"; exit 1; }
echo "$OUTPUT" | grep -q "kind: Service" || { echo "Missing Service"; exit 1; }
echo "$OUTPUT" | grep -q "kind: ConfigMap" || { echo "Missing ConfigMap"; exit 1; }
echo "$OUTPUT" | grep -q "kind: ServiceAccount" || { echo "Missing ServiceAccount"; exit 1; }
echo "All key resources present"
