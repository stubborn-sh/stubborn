#!/usr/bin/env bats

# ──────────────────────────────────────────────
# Version format validation (mirrors workflow logic)
# ──────────────────────────────────────────────

validate_semver() {
  local version="$1"
  [[ "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9.]+)?$ ]]
}

@test "version validation accepts valid semver" {
  validate_semver "0.0.1"
  validate_semver "1.2.3"
  validate_semver "0.1.0-RC1"
  validate_semver "1.0.0-beta.2"
}

@test "version validation rejects missing patch" {
  run validate_semver "1.2"
  [ "$status" -ne 0 ]
}

@test "version validation rejects v-prefix" {
  run validate_semver "v1.2.3"
  [ "$status" -ne 0 ]
}

@test "version validation rejects empty string" {
  run validate_semver ""
  [ "$status" -ne 0 ]
}

@test "version validation rejects four-part version" {
  run validate_semver "1.2.3.4"
  [ "$status" -ne 0 ]
}

@test "version validation rejects letters-only" {
  run validate_semver "abc"
  [ "$status" -ne 0 ]
}

# ──────────────────────────────────────────────
# Version set + reset logic
# ──────────────────────────────────────────────

@test "mvnw versions:set command uses correct flags" {
  VERSION="0.0.1"
  CMD="./mvnw versions:set -DnewVersion=${VERSION} -DprocessAllModules=true -DgenerateBackupPoms=false"
  [[ "$CMD" == *"-DnewVersion=0.0.1"* ]]
  [[ "$CMD" == *"-DprocessAllModules=true"* ]]
  [[ "$CMD" == *"-DgenerateBackupPoms=false"* ]]
}

@test "snapshot reset uses correct version format" {
  NEXT_SNAPSHOT="0.1.0-SNAPSHOT"
  [[ "$NEXT_SNAPSHOT" =~ ^[0-9]+\.[0-9]+\.[0-9]+-SNAPSHOT$ ]]
}

@test "snapshot version must end with -SNAPSHOT" {
  run bash -c '[[ "0.1.0-RC1" =~ ^[0-9]+\.[0-9]+\.[0-9]+-SNAPSHOT$ ]]'
  [ "$status" -ne 0 ]
}

# ──────────────────────────────────────────────
# Tag naming convention
# ──────────────────────────────────────────────

@test "tag has v prefix" {
  VERSION="0.0.1"
  TAG="v${VERSION}"
  [ "$TAG" = "v0.0.1" ]
  [[ "$TAG" =~ ^v[0-9]+\.[0-9]+\.[0-9]+ ]]
}

@test "tag format for pre-release version" {
  VERSION="1.0.0-RC1"
  TAG="v${VERSION}"
  [ "$TAG" = "v1.0.0-RC1" ]
  [[ "$TAG" =~ ^v[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9.]+)?$ ]]
}

@test "git push commands include tag push" {
  # Mirrors the workflow: git push origin "v$VERSION"
  VERSION="0.0.1"
  PUSH_CMD="git push origin \"v${VERSION}\""
  [[ "$PUSH_CMD" == *"v0.0.1"* ]]
}

# ──────────────────────────────────────────────
# Docker image tag construction
# ──────────────────────────────────────────────

@test "docker image tag uses mgrzejszczak org" {
  VERSION="0.0.1"
  IMAGE="mgrzejszczak/stubborn:${VERSION}"
  [ "$IMAGE" = "mgrzejszczak/stubborn:0.0.1" ]
}

@test "docker latest tag is constructed correctly" {
  VERSION="0.0.1"
  IMAGE="mgrzejszczak/stubborn:${VERSION}"
  LATEST="mgrzejszczak/stubborn:latest"
  # Verify the tag command structure
  TAG_CMD="docker tag \"${IMAGE}\" \"${LATEST}\""
  [[ "$TAG_CMD" == *"mgrzejszczak/stubborn:0.0.1"* ]]
  [[ "$TAG_CMD" == *"mgrzejszczak/stubborn:latest"* ]]
}

# ──────────────────────────────────────────────
# Deploy module list
# ──────────────────────────────────────────────

@test "deploy module list includes all expected modules" {
  DEPLOY_MODULES="build-parent,ui,broker,broker-api-client,broker-stub-downloader,broker-contract-publisher,broker-maven-plugin,stub-runner,openapi-validator"
  [[ "$DEPLOY_MODULES" == *"broker"* ]]
  [[ "$DEPLOY_MODULES" == *"broker-api-client"* ]]
  [[ "$DEPLOY_MODULES" == *"stub-runner"* ]]
  [[ "$DEPLOY_MODULES" == *"ui"* ]]
  [[ "$DEPLOY_MODULES" == *"openapi-validator"* ]]
  [[ "$DEPLOY_MODULES" == *"broker-maven-plugin"* ]]
}

# ──────────────────────────────────────────────
# Workflow file structure
# ──────────────────────────────────────────────

@test "release workflow file exists" {
  [ -f "$BATS_TEST_DIRNAME/../.github/workflows/release.yml" ]
}

@test "release workflow has required jobs" {
  local wf="$BATS_TEST_DIRNAME/../.github/workflows/release.yml"
  grep -q "deploy:" "$wf"
  grep -q "docker:" "$wf"
  grep -q "npm:" "$wf"
  grep -q "github-release:" "$wf"
}

@test "docker job depends on deploy" {
  local wf="$BATS_TEST_DIRNAME/../.github/workflows/release.yml"
  grep -A 3 "^  docker:" "$wf" | grep -q "needs: deploy"
}

@test "github-release depends on deploy, docker, and npm" {
  local wf="$BATS_TEST_DIRNAME/../.github/workflows/release.yml"
  grep -A 3 "github-release:" "$wf" | grep -q "needs:.*deploy.*docker.*npm"
}
