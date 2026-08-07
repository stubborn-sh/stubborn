#!/usr/bin/env bash
# Retag the locally built broker image for the Fly.io registry and push it.
#
# The Spring Boot buildpacks step (run inline in deploy-demo.yml) produces a local image
# whose repository name contains "stubborn". This finds that image, authenticates the
# Docker CLI against the Fly registry, and pushes it as
# registry.fly.io/stubborn-demo:latest for the subsequent `flyctl deploy`.
#
# FLY_API_TOKEN is provided by the workflow environment (used by flyctl).
#
# Usage: push-fly-image.sh
set -euo pipefail

flyctl auth docker
IMAGE_NAME=$(docker images --format '{{.Repository}}:{{.Tag}}' | grep 'stubborn' | head -1)
echo "Built image: $IMAGE_NAME"
docker tag "$IMAGE_NAME" registry.fly.io/stubborn-demo:latest
docker push registry.fly.io/stubborn-demo:latest
