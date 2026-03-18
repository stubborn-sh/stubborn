#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "==> Building UI..."
(cd broker-oss/ui && npm run build)

echo "==> Copying UI dist to broker static resources..."
mkdir -p broker-oss/broker/src/main/resources/static
rm -rf broker-oss/broker/src/main/resources/static/*
cp -r broker-oss/ui/dist/* broker-oss/broker/src/main/resources/static/

echo "==> Starting broker with dev profile..."
./mvnw spring-boot:run -pl broker-oss/broker -Dspring-boot.run.profiles=dev
