#!/usr/bin/env bash
# Rewrite the version fields in the project files that Maven's versions:set does NOT
# manage: the Helm chart and the Gradle broker plugin.
#
# Maven owns every pom.xml (bumped separately via `./mvnw versions:set`). This script
# owns the four non-Maven references so a release/snapshot bump keeps them in lockstep:
#
#   charts/stubborn-broker/Chart.yaml            version:      <- release value, -SNAPSHOT stripped
#   charts/stubborn-broker/Chart.yaml            appVersion:   <- full value (may be -SNAPSHOT)
#   broker-gradle-plugin/build.gradle            version =     <- full value
#   broker-gradle-plugin/gradle/libs.versions.toml broker-publisher = <- full value
#
# The only per-field difference is the Helm chart `version:`, which must be a plain
# SemVer with no build metadata, so -SNAPSHOT is stripped there. That derivation is
# deterministic from the argument, so ONE script handles both the release bump
# (0.0.1 -> stays 0.0.1) and the next-snapshot bump (0.1.0-SNAPSHOT -> chart 0.1.0,
# everything else 0.1.0-SNAPSHOT), exactly as the two original inline steps did.
#
# Must be run from the repository root (paths are repo-relative).
#
# Usage: set-project-versions.sh <version>
set -euo pipefail

VERSION="${1:?Usage: set-project-versions.sh <version>}"

# Helm chart `version:` must be plain SemVer (no -SNAPSHOT); appVersion keeps the full value.
CHART_VERSION="${VERSION//-SNAPSHOT/}"

sed -i "s/^version:.*/version: ${CHART_VERSION}/" charts/stubborn-broker/Chart.yaml
sed -i "s/^appVersion:.*/appVersion: \"${VERSION}\"/" charts/stubborn-broker/Chart.yaml
sed -i "s/^version = .*/version = '${VERSION}'/" broker-gradle-plugin/build.gradle
sed -i "s/^broker-publisher = .*/broker-publisher = \"${VERSION}\"/" broker-gradle-plugin/gradle/libs.versions.toml
