#!/usr/bin/env bats
# Tests for scripts/ci/dependabot-grace-merge.sh

setup() {
	REPO_ROOT="$(cd "$BATS_TEST_DIRNAME/../.." && pwd)"
	SCRIPT="$REPO_ROOT/scripts/ci/dependabot-grace-merge.sh"
	TMP="$(mktemp -d)"

	# A fixed "now" so createdAt ages are deterministic. Grace window is 2 days,
	# so cutoff = NOW_TS - 172800.
	export NOW_TS=1700000000        # 2023-11-14T22:13:20Z

	export PRS_JSON="$TMP/prs.json"
	export MERGED="$TMP/merged"      # PR numbers the stub was asked to merge
	export FAIL_CHECKS=""            # space-separated PR numbers whose checks fail
	: >"$MERGED"

	# Stub gh: dispatch on "pr list|checks|merge".
	cat >"$TMP/gh" <<-'STUB'
		#!/usr/bin/env bash
		case "$1 $2" in
		  "pr list")   cat "$PRS_JSON" ;;
		  "pr checks") n="$3"; case " $FAIL_CHECKS " in *" $n "*) exit 1 ;; esac; exit 0 ;;
		  "pr merge")  for a in "$@"; do last="$a"; done; printf '%s\n' "$last" >>"$MERGED"; exit 0 ;;
		  *)           exit 0 ;;
		esac
	STUB
	chmod +x "$TMP/gh"
	export GH="$TMP/gh"
	export REPO="acme/repo"
}

teardown() {
	rm -rf "$TMP"
}

# Helper: build a PR entry.
pr() { # number createdAt labels(space-separated)
	local labels_json
	labels_json="$(printf '%s\n' $3 | jq -R '{name: .}' | jq -s '.')"
	jq -n --argjson number "$1" --arg created "$2" --argjson labels "$labels_json" \
		'{number: $number, createdAt: $created, labels: $labels}'
}

@test "grace-merge: merges an aged, green patch PR" {
	jq -s '.' >"$PRS_JSON" <<-JSON
		$(pr 1 "2020-01-01T00:00:00Z" "dependabot:patch")
	JSON
	run bash "$SCRIPT"
	[ "$status" -eq 0 ]
	grep -qx "1" "$MERGED"
}

@test "grace-merge: skips a patch PR still within the grace window" {
	jq -s '.' >"$PRS_JSON" <<-JSON
		$(pr 2 "2023-11-14T00:00:00Z" "dependabot:patch")
	JSON
	run bash "$SCRIPT"
	[ "$status" -eq 0 ]
	! grep -qx "2" "$MERGED"
}

@test "grace-merge: never merges a major update" {
	jq -s '.' >"$PRS_JSON" <<-JSON
		$(pr 3 "2020-01-01T00:00:00Z" "dependabot:major")
	JSON
	run bash "$SCRIPT"
	[ "$status" -eq 0 ]
	! grep -qx "3" "$MERGED"
}

@test "grace-merge: merges a green security PR regardless of age" {
	jq -s '.' >"$PRS_JSON" <<-JSON
		$(pr 4 "2023-11-14T22:00:00Z" "dependabot:security dependabot:major")
	JSON
	run bash "$SCRIPT"
	[ "$status" -eq 0 ]
	grep -qx "4" "$MERGED"
}

@test "grace-merge: skips an aged patch PR whose checks are not green" {
	export FAIL_CHECKS="5"
	jq -s '.' >"$PRS_JSON" <<-JSON
		$(pr 5 "2020-01-01T00:00:00Z" "dependabot:minor")
	JSON
	run bash "$SCRIPT"
	[ "$status" -eq 0 ]
	! grep -qx "5" "$MERGED"
}
