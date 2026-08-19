#!/usr/bin/env bash
#
# Create the GitHub Release for a just-pushed release tag, uploading the runnable
# broker exec JAR and a SHA-256 checksums file as release assets, with a short
# "how to run" header prepended to the auto-generated notes.
#
# The broker exec JAR is expected at broker/target/stubborn-broker-<version>-exec.jar
# (produced by `mvn package -pl broker`). Requires the GH_TOKEN environment variable
# (set by the workflow).
#
# Usage: create-github-release.sh <version>
#
set -euo pipefail

VERSION="${1:?Usage: create-github-release.sh <version>}"

JAR="broker/target/stubborn-broker-${VERSION}-exec.jar"
if [ ! -f "$JAR" ]; then
	echo "::error::Expected broker exec jar not found: $JAR" >&2
	exit 1
fi

# SHA-256 checksum for the uploaded asset (basename only, so the file reads cleanly).
CHECKSUMS="stubborn-${VERSION}-checksums.txt"
(cd "$(dirname "$JAR")" && sha256sum "$(basename "$JAR")") >"$CHECKSUMS"

# "How to run" header, prepended to the auto-generated release notes.
NOTES_FILE="$(mktemp)"
cat >"$NOTES_FILE" <<EOF
## Run the broker

Docker:

\`\`\`bash
docker pull mgrzejszczak/stubborn:${VERSION}
docker run -p 8080:8080 mgrzejszczak/stubborn:${VERSION}
\`\`\`

Standalone JAR (attached below):

\`\`\`bash
java -jar stubborn-broker-${VERSION}-exec.jar
\`\`\`

Maven artifacts: [Maven Central](https://central.sonatype.com/namespace/sh.stubborn) &middot; NPM packages: [@stubborn-sh](https://www.npmjs.com/org/stubborn-sh)
EOF

# Idempotent: this script is also dispatchable on its own (publish-github-release.yml),
# so a re-run after a partial release must not fail on an existing release. Create it if
# absent; otherwise refresh the attached assets in place.
if gh release view "v${VERSION}" >/dev/null 2>&1; then
	echo "Release v${VERSION} already exists — refreshing assets."
	gh release upload "v${VERSION}" "$JAR" "$CHECKSUMS" --clobber
else
	gh release create "v${VERSION}" \
		--title "v${VERSION}" \
		--notes-file "$NOTES_FILE" \
		--generate-notes \
		"$JAR" \
		"$CHECKSUMS"
fi
