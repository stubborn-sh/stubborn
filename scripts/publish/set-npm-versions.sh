#!/usr/bin/env bash
# Set the version of the JS workspace root and every workspace package directly in
# package.json.
#
# We write package.json in place rather than using `npm version`, because `npm version`
# performs a registry lookup that fails with E404 for a package that was never published
# before (the first release of a brand-new scoped package). Writing the field directly
# avoids that.
#
# Run with the JS workspace root (js/) as the working directory — it edits ./package.json
# and globs packages/*/package.json relative to the current directory, matching the
# original `working-directory: js` step.
#
# Usage: set-npm-versions.sh <version>
set -euo pipefail

VERSION="${1:?Usage: set-npm-versions.sh <version>}"

# Set version directly in package.json files to avoid npm registry lookups
# (npm version fails with E404 if the package was never published before)
VERSION="$VERSION" node -e "
	const fs = require('fs');
	const root = JSON.parse(fs.readFileSync('package.json', 'utf8'));
	root.version = process.env.VERSION;
	fs.writeFileSync('package.json', JSON.stringify(root, null, 2) + '\n');
"
for pkg in packages/*/package.json; do
	VERSION="$VERSION" node -e "
		const fs = require('fs');
		const p = JSON.parse(fs.readFileSync('$pkg', 'utf8'));
		p.version = process.env.VERSION;
		fs.writeFileSync('$pkg', JSON.stringify(p, null, 2) + '\n');
	"
done
