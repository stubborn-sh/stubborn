#!/usr/bin/env bash
# Tag the freshly built broker image as :latest and push both the versioned tag and
# :latest to Docker Hub.
#
# The Spring Boot build-image step (run inline in release.yml) produces
# mgrzejszczak/stubborn:<version>. This re-tags it :latest and pushes both. `docker
# login` happens in a preceding workflow step, so the daemon is already authenticated.
#
# Usage: push-docker-images.sh <version>
set -euo pipefail

VERSION="${1:?Usage: push-docker-images.sh <version>}"

IMAGE="mgrzejszczak/stubborn:${VERSION}"

# Tag as latest as well
docker tag "${IMAGE}" "mgrzejszczak/stubborn:latest"

docker push "mgrzejszczak/stubborn:${VERSION}"
docker push "mgrzejszczak/stubborn:latest"
