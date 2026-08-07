#!/usr/bin/env bats
# Tests for scripts/publish/check-packages-exist.sh
#
# Stubs `npm` on PATH so the guard's loop / counter / exit logic can be exercised without
# touching the real registry.

setup() {
	REPO_ROOT="$(cd "$BATS_TEST_DIRNAME/../.." && pwd)"
	SCRIPT="$REPO_ROOT/scripts/publish/check-packages-exist.sh"
	STUBDIR="$(mktemp -d)"
	PATH="$STUBDIR:$PATH"
}

teardown() {
	rm -rf "$STUBDIR"
}

# Write an `npm` stub. $1 is a space-separated list of scoped package names that "exist";
# `npm view <name> name` returns 0 for those and non-zero for anything else.
make_npm_stub() {
	local existing="$1"
	cat > "$STUBDIR/npm" <<EOF
#!/usr/bin/env bash
# args: view <name> name
if [ "\$1" = "view" ]; then
	for e in $existing; do
		if [ "\$2" = "\$e" ]; then exit 0; fi
	done
	exit 1
fi
exit 0
EOF
	chmod +x "$STUBDIR/npm"
}

all_packages="@stubborn-sh/broker-client @stubborn-sh/publisher @stubborn-sh/stub-server @stubborn-sh/verifier @stubborn-sh/cli @stubborn-sh/jest @stubborn-sh/stubs-packager"

@test "check-packages-exist: passes when every package exists" {
	make_npm_stub "$all_packages"
	run "$SCRIPT"
	[ "$status" -eq 0 ]
	[[ "$output" == *"All packages exist on npm"* ]]
}

@test "check-packages-exist: fails and counts missing packages" {
	# Drop two packages from the existing set.
	make_npm_stub "@stubborn-sh/broker-client @stubborn-sh/publisher @stubborn-sh/stub-server @stubborn-sh/verifier @stubborn-sh/cli"
	run "$SCRIPT"
	[ "$status" -ne 0 ]
	[[ "$output" == *"@stubborn-sh/jest does not exist on npm yet"* ]]
	[[ "$output" == *"@stubborn-sh/stubs-packager does not exist on npm yet"* ]]
	[[ "$output" == *"2 package(s) not found on npm"* ]]
}

@test "check-packages-exist: fails when none exist" {
	make_npm_stub ""
	run "$SCRIPT"
	[ "$status" -ne 0 ]
	[[ "$output" == *"7 package(s) not found on npm"* ]]
}
