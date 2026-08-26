#!/usr/bin/env bash
#
# dependabot-grace-merge.sh
#
# Merge eligible Dependabot PRs. Called from the daily
# .github/workflows/dependabot-grace-merge.yml cron.
#
#   * Non-security patch / minor -> merge once green AND older than GRACE_DAYS.
#   * Security (CVE)             -> merge once green, no age gate (backstop for
#                                   dependabot-auto-merge.yml).
#   * Major                      -> never merged here.
#
# Eligibility uses the labels applied by dependabot-label.sh. Merges are
# green-gated: `gh pr checks` must pass, so red or still-running PRs are skipped.
#
# Environment:
#   REPO         owner/name of the repository (required; github.repository)
#   GRACE_DAYS   grace period in days (default 2)
#   GH           gh binary override (for tests)
#   NOW_TS       unix "now" override (for tests; defaults to the current time)
#
set -euo pipefail

REPO="${REPO:?REPO is required}"
GRACE_DAYS="${GRACE_DAYS:-2}"
GH="${GH:-gh}"
now="${NOW_TS:-$(date -u +%s)}"
cutoff=$((now - GRACE_DAYS * 86400))

prs_json="$("${GH}" pr list --repo "${REPO}" --author "app/dependabot" --state open \
	--json number,createdAt,labels --limit 100)"

count="$(printf '%s' "${prs_json}" | jq 'length')"
echo "open Dependabot PRs: ${count}"

for i in $(seq 0 $((count - 1))); do
	number="$(printf '%s' "${prs_json}" | jq -r ".[$i].number")"
	created="$(printf '%s' "${prs_json}" | jq -r ".[$i].createdAt")"
	labels=" $(printf '%s' "${prs_json}" | jq -r ".[$i].labels[].name" | tr '\n' ' ') "
	created_ts="$(date -u -d "${created}" +%s)"

	is_security=false
	case "${labels}" in *" dependabot:security "*) is_security=true ;; esac
	is_patchminor=false
	case "${labels}" in *" dependabot:patch "*|*" dependabot:minor "*) is_patchminor=true ;; esac

	if [ "${is_security}" != true ] && [ "${is_patchminor}" != true ]; then
		echo "PR #${number}: not security and not patch/minor -> skip"; continue
	fi
	if [ "${is_security}" != true ] && [ "${created_ts}" -gt "${cutoff}" ]; then
		echo "PR #${number}: within ${GRACE_DAYS}-day grace -> skip"; continue
	fi
	if ! "${GH}" pr checks "${number}" --repo "${REPO}" >/dev/null 2>&1; then
		echo "PR #${number}: checks not all green -> skip"; continue
	fi
	echo "PR #${number}: eligible -> merging (squash)"
	"${GH}" pr merge --squash --repo "${REPO}" "${number}" || echo "PR #${number}: merge failed (will retry next run)"
done
