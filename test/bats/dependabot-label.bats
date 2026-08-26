#!/usr/bin/env bats
# Tests for scripts/ci/dependabot-label.sh

setup() {
	REPO_ROOT="$(cd "$BATS_TEST_DIRNAME/../.." && pwd)"
	SCRIPT="$REPO_ROOT/scripts/ci/dependabot-label.sh"
	TMP="$(mktemp -d)"

	# Stub gh: append every invocation to a log so the test can assert on it.
	cat >"$TMP/gh" <<-'STUB'
		#!/usr/bin/env bash
		printf '%s\n' "$*" >>"$GH_LOG"
		exit 0
	STUB
	chmod +x "$TMP/gh"
	export GH="$TMP/gh"
	export GH_LOG="$TMP/log"
	: >"$GH_LOG"
}

teardown() {
	rm -rf "$TMP"
}

@test "dependabot-label: patch update gets the patch label, no security label" {
	run bash "$SCRIPT" "https://example/pr/1" "version-update:semver-patch" ""
	[ "$status" -eq 0 ]
	grep -q -- "--add-label dependabot:patch" "$GH_LOG"
	! grep -q "dependabot:security" "$GH_LOG"
}

@test "dependabot-label: minor update gets the minor label" {
	run bash "$SCRIPT" "https://example/pr/2" "version-update:semver-minor" ""
	[ "$status" -eq 0 ]
	grep -q -- "--add-label dependabot:minor" "$GH_LOG"
}

@test "dependabot-label: security update gets both the level and the security label" {
	run bash "$SCRIPT" "https://example/pr/3" "version-update:semver-major" "GHSA-xxxx-yyyy-zzzz"
	[ "$status" -eq 0 ]
	grep -q -- "--add-label dependabot:major" "$GH_LOG"
	grep -q -- "--add-label dependabot:security" "$GH_LOG"
}

@test "dependabot-label: a non-semver update-type applies no level label" {
	run bash "$SCRIPT" "https://example/pr/4" "" ""
	[ "$status" -eq 0 ]
	! grep -q -- "--add-label dependabot:" "$GH_LOG"
}

@test "dependabot-label: requires a PR url" {
	run bash "$SCRIPT"
	[ "$status" -ne 0 ]
}
