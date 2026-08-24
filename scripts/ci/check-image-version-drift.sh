#!/usr/bin/env bash
# Guard against broker container-image version drift.
#
# Every reference to the broker image (mgrzejszczak/stubborn, mgrzejszczak/stubborn-proxy)
# that pins a concrete version must agree with the reactor's ${project.version} (root
# pom.xml). This is what stops a version bump — which touches pom.xml and
# scripts/release/set-project-versions.sh — from silently leaving a stale image tag behind
# in a sample, an e2e test, or a manifest: exactly the failure that took CI red after the
# 0.2.0 -> 0.3.0-SNAPSHOT bump.
#
# Resolution per reference:
#   ${project.version}              -> correct by construction, ignored
#   ${STUBBORN_VERSION:-<v>}        -> checked: <v> must equal the project version
#   <v> (bare, starts with a digit) -> checked: <v> must equal the project version
#   latest / any other ${...}       -> ignored (rolling / property-driven)
#
# Only tracked files are scanned; bats fixture dirs (which pin intentional versions) and
# this script are skipped. Shell scripts are not scanned — image tags there are always
# parameterised.
#
# Usage: check-image-version-drift.sh [repo-root]   (defaults to the git toplevel)
set -euo pipefail

ROOT="${1:-$(git -C "$(dirname "$0")" rev-parse --show-toplevel)}"
cd "${ROOT}"

# Reactor version: the project's own <version> — the first <version> that is NOT inside
# the <parent> block (the root aggregator pom has no parent, so this is simply the first).
project_version="$(awk '
  /<parent>/ { in_parent = 1 }
  /<\/parent>/ { in_parent = 0; next }
  !in_parent && match($0, /<version>[^<]+<\/version>/) {
    v = substr($0, RSTART, RLENGTH)
    gsub(/<\/?version>|[[:space:]]/, "", v)
    print v
    exit
  }
' pom.xml)"

if [ -z "${project_version}" ]; then
  echo "check-image-version-drift: could not determine project version from pom.xml" >&2
  exit 2
fi

self="scripts/ci/check-image-version-drift.sh"
image_re='mgrzejszczak/stubborn[a-z-]*:'

violations=0
while IFS= read -r file; do
  case "${file}" in
    test/bats/* | tests/* | "${self}") continue ;;
  esac
  while IFS= read -r match; do
    tag="${match#*:}"
    case "${tag}" in
      '${project.version}'*) continue ;;
      '${STUBBORN_VERSION:-'*)
        pinned="${tag#\$\{STUBBORN_VERSION:-}"
        pinned="${pinned%%\}*}"
        ;;
      latest | '$'*) continue ;;
      [0-9]*) pinned="${tag}" ;;
      *) continue ;;
    esac
    if [ "${pinned}" != "${project_version}" ]; then
      echo "DRIFT: ${file} pins '${match}' but project version is '${project_version}'"
      violations=$((violations + 1))
    fi
  done < <(grep -oE "${image_re}[^\"'[:space:])]+" "${file}" 2>/dev/null || true)
done < <(git ls-files -- '*.java' '*.yaml' '*.yml' '*.xml' '*.md' '*.adoc' '*.gradle' '*.toml')

if [ "${violations}" -gt 0 ]; then
  echo ""
  echo "${violations} image-version drift(s) found; bump them to '${project_version}'."
  echo "Release bumps run scripts/release/set-project-versions.sh; prefer property-driven"
  echo "references (\${project.version} / \${STUBBORN_VERSION:-...}) for new image tags."
  exit 1
fi

echo "check-image-version-drift: OK — all broker image references agree with '${project_version}'"
