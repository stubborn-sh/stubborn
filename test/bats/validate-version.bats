#!/usr/bin/env bats
# Tests for scripts/release/validate-version.sh

setup() {
	REPO_ROOT="$(cd "$BATS_TEST_DIRNAME/../.." && pwd)"
	SCRIPT="$REPO_ROOT/scripts/release/validate-version.sh"
}

@test "validate-version: accepts plain semver" {
	run "$SCRIPT" "0.0.1"
	[ "$status" -eq 0 ]
	run "$SCRIPT" "1.2.3"
	[ "$status" -eq 0 ]
}

@test "validate-version: accepts pre-release suffixes" {
	run "$SCRIPT" "0.1.0-RC1"
	[ "$status" -eq 0 ]
	run "$SCRIPT" "1.0.0-beta.2"
	[ "$status" -eq 0 ]
}

@test "validate-version: rejects missing patch" {
	run "$SCRIPT" "1.2"
	[ "$status" -ne 0 ]
	[[ "$output" == *"Invalid version format"* ]]
}

@test "validate-version: rejects v-prefix" {
	run "$SCRIPT" "v1.2.3"
	[ "$status" -ne 0 ]
}

@test "validate-version: rejects four-part version" {
	run "$SCRIPT" "1.2.3.4"
	[ "$status" -ne 0 ]
}

@test "validate-version: rejects letters-only" {
	run "$SCRIPT" "abc"
	[ "$status" -ne 0 ]
}

@test "validate-version: fails with usage when no argument" {
	run "$SCRIPT"
	[ "$status" -ne 0 ]
}
