#!/usr/bin/env bats
# Tests for scripts/publish/update-package-deps.sh
#
# Runs with a throwaway JS-workspace layout (packages/*/package.json) as the working
# directory, exactly as the workflow invokes it, and asserts that only @stubborn-sh/*
# dependency versions are rewritten. Requires node (present in CI and the dev image).

setup() {
	REPO_ROOT="$(cd "$BATS_TEST_DIRNAME/../.." && pwd)"
	SCRIPT="$REPO_ROOT/scripts/publish/update-package-deps.sh"
	TMP="$(mktemp -d)"
	mkdir -p "$TMP/packages/verifier" "$TMP/packages/cli"
	cat > "$TMP/packages/verifier/package.json" <<'JSON'
{
  "name": "@stubborn-sh/verifier",
  "version": "0.0.9",
  "dependencies": {
    "@stubborn-sh/broker-client": "0.0.9",
    "left-pad": "1.3.0"
  },
  "peerDependencies": {
    "@stubborn-sh/publisher": "0.0.9"
  }
}
JSON
	cat > "$TMP/packages/cli/package.json" <<'JSON'
{
  "name": "@stubborn-sh/cli",
  "version": "0.0.9",
  "devDependencies": {
    "@stubborn-sh/verifier": "0.0.9",
    "typescript": "5.4.0"
  }
}
JSON
}

teardown() {
	rm -rf "$TMP"
}

@test "update-package-deps: rewrites only @stubborn-sh/* deps to the new version" {
	cd "$TMP"
	run "$SCRIPT" "1.2.3"
	[ "$status" -eq 0 ]

	# Internal deps bumped.
	grep -q '"@stubborn-sh/broker-client": "1.2.3"' packages/verifier/package.json
	grep -q '"@stubborn-sh/publisher": "1.2.3"' packages/verifier/package.json
	grep -q '"@stubborn-sh/verifier": "1.2.3"' packages/cli/package.json

	# Third-party deps untouched.
	grep -q '"left-pad": "1.3.0"' packages/verifier/package.json
	grep -q '"typescript": "5.4.0"' packages/cli/package.json

	# The package's own version field is NOT touched by this script.
	grep -q '"version": "0.0.9"' packages/verifier/package.json
}

@test "update-package-deps: fails with usage when no argument" {
	cd "$TMP"
	run "$SCRIPT"
	[ "$status" -ne 0 ]
}
