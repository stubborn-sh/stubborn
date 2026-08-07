#!/usr/bin/env bats
# Tests for scripts/demo/wait-for-app.sh
#
# Stubs `curl` and `sleep` on PATH so the polling loop is exercised instantly and without
# a network.

setup() {
	REPO_ROOT="$(cd "$BATS_TEST_DIRNAME/../.." && pwd)"
	SCRIPT="$REPO_ROOT/scripts/demo/wait-for-app.sh"
	STUBDIR="$(mktemp -d)"
	# sleep is a no-op so the 10s waits are instant.
	printf '#!/usr/bin/env bash\nexit 0\n' > "$STUBDIR/sleep"
	chmod +x "$STUBDIR/sleep"
	PATH="$STUBDIR:$PATH"
	export DEMO_URL="http://example.test"
}

teardown() {
	rm -rf "$STUBDIR"
}

@test "wait-for-app: exits 0 once health reports UP" {
	printf '#!/usr/bin/env bash\necho "{\\"status\\":\\"UP\\"}"\n' > "$STUBDIR/curl"
	chmod +x "$STUBDIR/curl"
	run "$SCRIPT"
	[ "$status" -eq 0 ]
	[[ "$output" == *"App is ready"* ]]
}

@test "wait-for-app: fails when health never reports UP" {
	# curl exits non-zero and prints nothing -> never UP.
	printf '#!/usr/bin/env bash\nexit 1\n' > "$STUBDIR/curl"
	chmod +x "$STUBDIR/curl"
	run "$SCRIPT"
	[ "$status" -ne 0 ]
	[[ "$output" == *"did not become ready"* ]]
}

@test "wait-for-app: fails when DEMO_URL unset" {
	unset DEMO_URL
	run "$SCRIPT"
	[ "$status" -ne 0 ]
}
