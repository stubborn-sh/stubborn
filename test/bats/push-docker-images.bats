#!/usr/bin/env bats
# Tests for scripts/release/push-docker-images.sh
#
# Stubs `docker` on PATH and records its invocations so we can assert the exact tag/push
# image references without a Docker daemon or registry.

setup() {
	REPO_ROOT="$(cd "$BATS_TEST_DIRNAME/../.." && pwd)"
	SCRIPT="$REPO_ROOT/scripts/release/push-docker-images.sh"
	STUBDIR="$(mktemp -d)"
	CALLS="$STUBDIR/calls.log"
	cat > "$STUBDIR/docker" <<EOF
#!/usr/bin/env bash
echo "\$@" >> "$CALLS"
EOF
	chmod +x "$STUBDIR/docker"
	PATH="$STUBDIR:$PATH"
}

teardown() {
	rm -rf "$STUBDIR"
}

@test "push-docker-images: tags latest and pushes version + latest" {
	run "$SCRIPT" "0.0.1"
	[ "$status" -eq 0 ]
	grep -qx "tag mgrzejszczak/stubborn:0.0.1 mgrzejszczak/stubborn:latest" "$CALLS"
	grep -qx "push mgrzejszczak/stubborn:0.0.1" "$CALLS"
	grep -qx "push mgrzejszczak/stubborn:latest" "$CALLS"
}

@test "push-docker-images: pushes in the right order (tag before pushes)" {
	run "$SCRIPT" "1.2.3"
	[ "$status" -eq 0 ]
	# First recorded call is the tag.
	head -1 "$CALLS" | grep -qx "tag mgrzejszczak/stubborn:1.2.3 mgrzejszczak/stubborn:latest"
}

@test "push-docker-images: fails with usage when no argument" {
	run "$SCRIPT"
	[ "$status" -ne 0 ]
}
