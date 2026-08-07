#!/usr/bin/env bats
# Tests for scripts/demo/push-fly-image.sh
#
# Stubs `flyctl` and `docker` on PATH. The docker stub returns a canned `docker images`
# listing so we can assert the grep/head selection and the resulting tag/push.

setup() {
	REPO_ROOT="$(cd "$BATS_TEST_DIRNAME/../.." && pwd)"
	SCRIPT="$REPO_ROOT/scripts/demo/push-fly-image.sh"
	STUBDIR="$(mktemp -d)"
	CALLS="$STUBDIR/calls.log"
	cat > "$STUBDIR/flyctl" <<EOF
#!/usr/bin/env bash
echo "flyctl \$@" >> "$CALLS"
EOF
	chmod +x "$STUBDIR/flyctl"
	PATH="$STUBDIR:$PATH"
}

teardown() {
	rm -rf "$STUBDIR"
}

make_docker_stub() {
	# $1 is the newline-separated `docker images --format` listing to emit.
	local images="$1"
	cat > "$STUBDIR/docker" <<EOF
#!/usr/bin/env bash
if [ "\$1" = "images" ]; then
	printf '%s\n' "$images"
	exit 0
fi
echo "docker \$@" >> "$CALLS"
EOF
	chmod +x "$STUBDIR/docker"
}

@test "push-fly-image: selects the first stubborn image and pushes it to Fly" {
	make_docker_stub $'paketobuildpacks/run:latest\nmgrzejszczak/stubborn:0.1.0-SNAPSHOT\nsome/other:latest'
	run "$SCRIPT"
	[ "$status" -eq 0 ]
	[[ "$output" == *"Built image: mgrzejszczak/stubborn:0.1.0-SNAPSHOT"* ]]
	grep -qx "flyctl auth docker" "$CALLS"
	grep -qx "docker tag mgrzejszczak/stubborn:0.1.0-SNAPSHOT registry.fly.io/stubborn-demo:latest" "$CALLS"
	grep -qx "docker push registry.fly.io/stubborn-demo:latest" "$CALLS"
}

@test "push-fly-image: head picks the first match when several stubborn images exist" {
	make_docker_stub $'mgrzejszczak/stubborn:newest\nmgrzejszczak/stubborn:older'
	run "$SCRIPT"
	[ "$status" -eq 0 ]
	[[ "$output" == *"Built image: mgrzejszczak/stubborn:newest"* ]]
	grep -qx "docker tag mgrzejszczak/stubborn:newest registry.fly.io/stubborn-demo:latest" "$CALLS"
}
