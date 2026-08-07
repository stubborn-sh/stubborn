#!/usr/bin/env bats
# Tests for scripts/publish/set-npm-versions.sh
#
# Runs with a throwaway JS-workspace layout as the working directory and asserts the
# root and every package get the new version. Requires node.

setup() {
	REPO_ROOT="$(cd "$BATS_TEST_DIRNAME/../.." && pwd)"
	SCRIPT="$REPO_ROOT/scripts/publish/set-npm-versions.sh"
	TMP="$(mktemp -d)"
	mkdir -p "$TMP/packages/verifier" "$TMP/packages/cli"
	echo '{ "name": "root", "version": "0.0.9" }' > "$TMP/package.json"
	echo '{ "name": "@stubborn-sh/verifier", "version": "0.0.9" }' > "$TMP/packages/verifier/package.json"
	echo '{ "name": "@stubborn-sh/cli", "version": "0.0.9" }' > "$TMP/packages/cli/package.json"
}

teardown() {
	rm -rf "$TMP"
}

@test "set-npm-versions: sets version on root and every package" {
	cd "$TMP"
	run "$SCRIPT" "2.0.0"
	[ "$status" -eq 0 ]
	grep -q '"version": "2.0.0"' package.json
	grep -q '"version": "2.0.0"' packages/verifier/package.json
	grep -q '"version": "2.0.0"' packages/cli/package.json
}

@test "set-npm-versions: preserves other fields (valid JSON)" {
	cd "$TMP"
	run "$SCRIPT" "2.0.0"
	[ "$status" -eq 0 ]
	node -e "JSON.parse(require('fs').readFileSync('packages/verifier/package.json','utf8'))"
	grep -q '"name": "@stubborn-sh/verifier"' packages/verifier/package.json
}

@test "set-npm-versions: fails with usage when no argument" {
	cd "$TMP"
	run "$SCRIPT"
	[ "$status" -ne 0 ]
}
