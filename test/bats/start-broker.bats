#!/usr/bin/env bats
# Tests for scripts/load/start-broker.sh
#
# Stubs `java` (background launch), `curl` (health probe) and `sleep` so the readiness
# loop is exercised without a real broker. The script reads HEALTH_URL from the
# environment (defaulting to the CI port), which is the test seam used here.

setup() {
	REPO_ROOT="$(cd "$BATS_TEST_DIRNAME/../.." && pwd)"
	SCRIPT="$REPO_ROOT/scripts/load/start-broker.sh"
	STUBDIR="$(mktemp -d)"
	printf '#!/usr/bin/env bash\nexit 0\n' > "$STUBDIR/java"
	printf '#!/usr/bin/env bash\nexit 0\n' > "$STUBDIR/sleep"
	chmod +x "$STUBDIR/java" "$STUBDIR/sleep"
	PATH="$STUBDIR:$PATH"
	export HEALTH_URL="http://example.test/actuator/health"
}

teardown() {
	rm -rf "$STUBDIR"
}

@test "start-broker: reports ready when health probe succeeds" {
	printf '#!/usr/bin/env bash\nexit 0\n' > "$STUBDIR/curl"
	chmod +x "$STUBDIR/curl"
	cd "$REPO_ROOT"
	run "$SCRIPT"
	[ "$status" -eq 0 ]
	[[ "$output" == *"Broker is ready"* ]]
}

@test "start-broker: fails when health probe never succeeds" {
	printf '#!/usr/bin/env bash\nexit 1\n' > "$STUBDIR/curl"
	chmod +x "$STUBDIR/curl"
	cd "$REPO_ROOT"
	run "$SCRIPT"
	[ "$status" -ne 0 ]
	[[ "$output" == *"failed to start"* ]]
}
