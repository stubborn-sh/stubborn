#!/usr/bin/env bash
#
# dependabot-label.sh
#
# Label a Dependabot PR by its semver level and mark security (CVE) updates, so
# dependabot-grace-merge.sh can act on it later. Called from
# .github/workflows/dependabot-auto-merge.yml with the fetch-metadata outputs.
#
# Usage: dependabot-label.sh <pr-url> <update-type> [ghsa-id]
#   <pr-url>        the Dependabot PR (github.event.pull_request.html_url)
#   <update-type>   e.g. "version-update:semver-patch" (steps.meta.outputs.update-type)
#   [ghsa-id]       non-empty for security updates (steps.meta.outputs.ghsa-id)
#
# Environment:
#   GH   gh binary override (for tests)
#
set -euo pipefail

PR_URL="${1:?usage: dependabot-label.sh <pr-url> <update-type> [ghsa-id]}"
UPDATE_TYPE="${2:-}"
GHSA_ID="${3:-}"
GH="${GH:-gh}"

# Apply a "dependabot:<level>" label when update-type is a semver update. The
# prefix strip only changes the string for "version-update:semver-*" values.
level="${UPDATE_TYPE#version-update:semver-}"
if [ -n "${level}" ] && [ "${level}" != "${UPDATE_TYPE}" ]; then
	"${GH}" label create "dependabot:${level}" --color ededed --force >/dev/null 2>&1 || true
	"${GH}" pr edit "${PR_URL}" --add-label "dependabot:${level}" || true
fi

if [ -n "${GHSA_ID}" ]; then
	"${GH}" label create "dependabot:security" --color b60205 --force >/dev/null 2>&1 || true
	"${GH}" pr edit "${PR_URL}" --add-label "dependabot:security" || true
fi
