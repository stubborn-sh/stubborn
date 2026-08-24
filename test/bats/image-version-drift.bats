#!/usr/bin/env bats
# Tests for scripts/ci/check-image-version-drift.sh
#
# The guard fails a build when any broker container-image reference pins a concrete
# version that disagrees with the reactor's ${project.version}. These tests build a
# throwaway git repo (the guard scans `git ls-files`) with a known project version and
# assert both the clean and the drifted outcomes. A final test runs the guard against the
# real repository, so a stale tag committed anywhere fails CI here too.

setup() {
	REPO_ROOT="$(cd "$BATS_TEST_DIRNAME/../.." && pwd)"
	SCRIPT="$REPO_ROOT/scripts/ci/check-image-version-drift.sh"
	TMP="$(mktemp -d)"
	cd "$TMP"
	git init -q
	git config user.email "t@example.com"
	git config user.name "t"
	mkdir -p scripts/ci
	cp "$SCRIPT" scripts/ci/check-image-version-drift.sh
	cat > pom.xml <<'POM'
<project>
	<groupId>sh.stubborn</groupId>
	<artifactId>stubborn</artifactId>
	<version>0.3.0-SNAPSHOT</version>
	<packaging>pom</packaging>
</project>
POM
}

teardown() {
	rm -rf "$TMP"
}

@test "image-drift: passes when every image ref matches the project version" {
	cat > compose.yaml <<'Y'
image: mgrzejszczak/stubborn:${STUBBORN_VERSION:-0.3.0-SNAPSHOT}
image: mgrzejszczak/stubborn-proxy:${STUBBORN_VERSION:-0.3.0-SNAPSHOT}
Y
	echo 'IMAGE = "mgrzejszczak/stubborn:${project.version}"' > Container.java
	git add -A
	run bash scripts/ci/check-image-version-drift.sh "$TMP"
	[ "$status" -eq 0 ]
	[[ "$output" == *"OK"* ]]
}

@test "image-drift: fails on a bare literal that drifts from the project version" {
	echo 'new GenericContainer("mgrzejszczak/stubborn:0.1.0-SNAPSHOT")' > Container.java
	git add -A
	run bash scripts/ci/check-image-version-drift.sh "$TMP"
	[ "$status" -eq 1 ]
	[[ "$output" == *"DRIFT"* ]]
	[[ "$output" == *"0.1.0-SNAPSHOT"* ]]
}

@test "image-drift: fails on a compose fallback that drifts from the project version" {
	echo 'image: mgrzejszczak/stubborn:${STUBBORN_VERSION:-0.2.0-SNAPSHOT}' > compose.yaml
	git add -A
	run bash scripts/ci/check-image-version-drift.sh "$TMP"
	[ "$status" -eq 1 ]
	[[ "$output" == *"0.2.0-SNAPSHOT"* ]]
}

@test "image-drift: ignores :latest and \${project.version} references" {
	cat > doc.md <<'M'
docker run mgrzejszczak/stubborn:latest
image: mgrzejszczak/stubborn:${project.version}
M
	git add -A
	run bash scripts/ci/check-image-version-drift.sh "$TMP"
	[ "$status" -eq 0 ]
}

@test "image-drift: the real repository is free of image-version drift" {
	run bash "$SCRIPT" "$REPO_ROOT"
	[ "$status" -eq 0 ]
	[[ "$output" == *"OK"* ]]
}
