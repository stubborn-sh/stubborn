#!/usr/bin/env bats
# Tests for scripts/publish/verify-snapshot-version.sh

setup() {
	REPO_ROOT="$(cd "$BATS_TEST_DIRNAME/../.." && pwd)"
	SCRIPT="$REPO_ROOT/scripts/publish/verify-snapshot-version.sh"
}

@test "verify-snapshot-version: passes for -SNAPSHOT" {
	run "$SCRIPT" "0.1.0-SNAPSHOT"
	[ "$status" -eq 0 ]
	[[ "$output" == *"Publishing snapshot: 0.1.0-SNAPSHOT"* ]]
}

@test "verify-snapshot-version: fails for release version" {
	run "$SCRIPT" "0.1.0"
	[ "$status" -ne 0 ]
	[[ "$output" == *"is not a SNAPSHOT"* ]]
}

@test "verify-snapshot-version: fails for RC (not a SNAPSHOT)" {
	run "$SCRIPT" "1.0.0-RC1"
	[ "$status" -ne 0 ]
}

@test "verify-snapshot-version: fails with usage when no argument" {
	run "$SCRIPT"
	[ "$status" -ne 0 ]
}
