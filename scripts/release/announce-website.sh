#!/usr/bin/env bash
#
# Tell stubborn.sh that a release was published, so it turns the release notes
# into a blog post.
#
# Usage: announce-website.sh <repo-short-name> <version>
#
# This never fails a release. The website also sweeps the GitHub Releases API on
# a schedule, so a missed announcement only delays the post — it never loses it.
# That is why a missing token or a failed call is reported and shrugged off.
#
# Environment:
#   GH_TOKEN      token with permission to dispatch to the website repo
#                 (secrets.WEBSITE_DISPATCH_TOKEN); skipped when unset
#   WEBSITE_REPO  override the target repository (default stubborn-sh/stubborn-website)
#   GH            override the gh binary (tests)
#
set -uo pipefail

REPO="${1:?Usage: announce-website.sh <repo-short-name> <version>}"
VERSION="${2:?Usage: announce-website.sh <repo-short-name> <version>}"
WEBSITE_REPO="${WEBSITE_REPO:-stubborn-sh/stubborn-website}"
GH="${GH:-gh}"
TAG="v${VERSION#v}"

if [[ -z "${GH_TOKEN:-}" ]]; then
	echo "No GH_TOKEN — skipping the stubborn.sh announcement for ${REPO} ${TAG}."
	echo "The website sweeps published releases on a schedule, so the post still appears."
	exit 0
fi

payload="$(jq -n --arg repo "$REPO" --arg tag "$TAG" \
	'{event_type: "release-published", client_payload: {repo: $repo, tag: $tag}}')"

if printf '%s' "$payload" | "$GH" api "repos/${WEBSITE_REPO}/dispatches" --method POST --input -; then
	echo "Announced ${REPO} ${TAG} to ${WEBSITE_REPO}."
else
	echo "Could not announce ${REPO} ${TAG} to ${WEBSITE_REPO} — the scheduled sweep will pick it up." >&2
fi

exit 0
