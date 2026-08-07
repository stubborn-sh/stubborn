#!/usr/bin/env bash
# Validate that a release version is well-formed semver.
#
# Accepts MAJOR.MINOR.PATCH with an optional pre-release suffix, e.g. 0.0.1 or
# 0.1.0-RC1. Fails (exit 1) with a GitHub Actions ::error:: annotation otherwise.
#
# Used by release.yml before any version-set / deploy runs, so a typo in the
# workflow_dispatch input aborts the release before it touches Maven Central.
#
# Usage: validate-version.sh <version>
set -euo pipefail

VERSION="${1:?Usage: validate-version.sh <version>}"

if [[ ! "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9.]+)?$ ]]; then
	echo "::error::Invalid version format: $VERSION (expected semver, e.g. 0.0.1 or 0.1.0-RC1)"
	exit 1
fi
