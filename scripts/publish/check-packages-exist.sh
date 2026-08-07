#!/usr/bin/env bash
# Guard: fail unless every @stubborn-sh/* npm package already exists on the registry.
#
# The very first publish of a new scoped package requires interactive 2FA, which an
# automation token cannot do. This checks each expected package with `npm view` and, if
# any are missing, fails with instructions to run the first publish manually — so the CI
# job fails fast with a clear message instead of a confusing mid-publish auth error.
#
# Reads the npm auth token from the environment (NODE_AUTH_TOKEN) as npm does; it is
# never referenced or echoed here.
#
# Usage: check-packages-exist.sh
set -euo pipefail

MISSING=0
for pkg in broker-client publisher stub-server verifier cli jest stubs-packager; do
	if ! npm view "@stubborn-sh/${pkg}" name >/dev/null 2>&1; then
		echo "::error::@stubborn-sh/${pkg} does not exist on npm yet"
		MISSING=$((MISSING + 1))
	fi
done
if [ "$MISSING" -gt 0 ]; then
	echo ""
	echo "::error::${MISSING} package(s) not found on npm. First publish of new scoped packages requires interactive 2FA."
	echo "::error::Run manually: cd js && npm login && npm publish --workspaces --access public"
	exit 1
fi
echo "All packages exist on npm — automation token can publish new versions"
