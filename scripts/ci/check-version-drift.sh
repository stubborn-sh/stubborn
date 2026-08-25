#!/usr/bin/env bash
# Guard against stubborn version drift in the non-Maven references.
#
# Maven owns every pom.xml; scripts/release/set-project-versions.sh owns the rest (Helm
# chart, Gradle broker plugin, samples compose + gradle-consumer + jar-consumer). This
# guard fails the build if any of those concrete version references disagrees with the
# reactor's ${project.version} — the "stale tag/plugin behind a bump" failure that took CI
# red after 0.2.0 -> 0.3.0-SNAPSHOT (twice: the broker image, then the Gradle plugin).
#
# Checked references (all must equal ${project.version}):
#   - broker image tags       mgrzejszczak/stubborn[-proxy]:<v>       (java/yaml/xml/md/...)
#   - gradle plugin version    broker-plugin/broker-publisher = "<v>"  (*.toml)
#   - jar-consumer fallback    STUBS_JAR_VERSION"] ?? "<v>"            (*.ts)
# Property-driven refs (${project.version}, ${STUBBORN_VERSION:-...}) and :latest are ok.
# The Helm chart is bumped by the release script but intentionally strips -SNAPSHOT, so it
# is validated by set-project-versions.bats rather than here.
#
# Only tracked files are scanned; bats fixture dirs (which pin intentional versions) and
# this script are skipped.
#
# Usage: check-version-drift.sh [repo-root]   (defaults to the git toplevel)
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
  echo "check-version-drift: could not determine project version from pom.xml" >&2
  exit 2
fi

self="scripts/ci/check-version-drift.sh"
violations=0

# flag <file> <pinned-version> <label>
flag() {
  if [ -n "$2" ] && [ "$2" != "${project_version}" ]; then
    echo "DRIFT: $1 pins '$2' ($3) but project version is '${project_version}'"
    violations=$((violations + 1))
  fi
}

while IFS= read -r file; do
  case "${file}" in
    test/bats/* | tests/* | "${self}") continue ;;
  esac

  # 1) Broker image tags.
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
    flag "${file}" "${pinned}" "image ${match%%:*}"
  done < <(grep -oE "mgrzejszczak/stubborn[a-z-]*:[^\"'[:space:])]+" "${file}" 2>/dev/null || true)

  # 2) Gradle broker-plugin / broker-publisher version keys (unambiguously the broker).
  while IFS= read -r match; do
    pinned="${match#*\"}"
    pinned="${pinned%\"}"
    flag "${file}" "${pinned}" "gradle ${match%% *}"
  done < <(grep -oE '^(broker-plugin|broker-publisher) = "[^"]+"' "${file}" 2>/dev/null || true)

  # 3) jar-consumer STUBS_JAR_VERSION fallback default.
  while IFS= read -r match; do
    pinned="${match#*?? \"}"
    pinned="${pinned%\"}"
    flag "${file}" "${pinned}" "STUBS_JAR_VERSION fallback"
  done < <(grep -oE 'STUBS_JAR_VERSION"\] \?\? "[^"]+"' "${file}" 2>/dev/null || true)

done < <(git ls-files -- '*.java' '*.yaml' '*.yml' '*.xml' '*.md' '*.adoc' '*.gradle' '*.toml' '*.ts')

if [ "${violations}" -gt 0 ]; then
  echo ""
  echo "${violations} version drift(s) found; bump them to '${project_version}'."
  echo "Release bumps run scripts/release/set-project-versions.sh; prefer property-driven"
  echo "references (\${project.version} / \${STUBBORN_VERSION:-...}) for new image tags."
  exit 1
fi

echo "check-version-drift: OK — all non-Maven version references agree with '${project_version}'"
