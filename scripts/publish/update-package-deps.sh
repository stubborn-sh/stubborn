#!/usr/bin/env bash
# Pin every internal @stubborn-sh/* dependency across the JS workspace to one version.
#
# After `npm version` bumps each package's own version, its references to sibling
# @stubborn-sh/* packages (in dependencies / devDependencies / peerDependencies) still
# point at the previous version. This rewrites all of them to VERSION so the published
# set is internally consistent.
#
# Shared by release.yml and publish-npm.yml. Run with the JS workspace root (js/) as the
# working directory — it globs packages/*/package.json relative to the current directory,
# matching the original `working-directory: js` steps.
#
# Usage: update-package-deps.sh <version>
set -euo pipefail

VERSION="${1:?Usage: update-package-deps.sh <version>}"

for pkg in packages/*/package.json; do
	VERSION="$VERSION" node -e "
		const fs = require('fs');
		const p = JSON.parse(fs.readFileSync('$pkg', 'utf8'));
		for (const depType of ['dependencies', 'devDependencies', 'peerDependencies']) {
			if (p[depType]) {
				for (const [name, ver] of Object.entries(p[depType])) {
					if (name.startsWith('@stubborn-sh/')) p[depType][name] = process.env.VERSION;
				}
			}
		}
		fs.writeFileSync('$pkg', JSON.stringify(p, null, 2) + '\n');
	"
done
