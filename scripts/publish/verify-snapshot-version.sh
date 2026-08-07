#!/usr/bin/env bash
# Guard: fail unless the given version is a -SNAPSHOT.
#
# The snapshot-publish workflow must never deploy a release (non-SNAPSHOT) version to the
# snapshot repository. The caller resolves the project version (via `mvnw help:evaluate`)
# and passes it here; this aborts the publish if it is not a SNAPSHOT.
#
# Usage: verify-snapshot-version.sh <version>
set -euo pipefail

VERSION="${1:?Usage: verify-snapshot-version.sh <version>}"

if [[ ! "$VERSION" == *-SNAPSHOT ]]; then
	echo "::error::Version $VERSION is not a SNAPSHOT — skipping snapshot publish"
	exit 1
fi
echo "Publishing snapshot: $VERSION"
