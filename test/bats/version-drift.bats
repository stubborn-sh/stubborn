#!/usr/bin/env bats
# Tests for scripts/ci/check-version-drift.sh
#
# The guard fails a build when any non-Maven stubborn version reference (broker image tag,
# Gradle broker-plugin version, or the jar-consumer STUBS_JAR_VERSION fallback) disagrees
# with the reactor's ${project.version}. These tests build a throwaway git repo (the guard
# scans `git ls-files`) with a known project version and assert both clean and drifted
# outcomes. A final test runs the guard against the real repository, so a stale reference
# committed anywhere fails CI here too.

setup() {
	REPO_ROOT="$(cd "$BATS_TEST_DIRNAME/../.." && pwd)"
	SCRIPT="$REPO_ROOT/scripts/ci/check-version-drift.sh"
	TMP="$(mktemp -d)"
	cd "$TMP"
	git init -q
	git config user.email "t@example.com"
	git config user.name "t"
	mkdir -p scripts/ci gradle ts
	cp "$SCRIPT" scripts/ci/check-version-drift.sh
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

@test "version-drift: passes when every reference matches the project version" {
	cat > compose.yaml <<'Y'
image: mgrzejszczak/stubborn:${STUBBORN_VERSION:-0.3.0-SNAPSHOT}
image: mgrzejszczak/stubborn-proxy:${STUBBORN_VERSION:-0.3.0-SNAPSHOT}
Y
	echo 'IMAGE = "mgrzejszczak/stubborn:${project.version}"' > Container.java
	printf '[versions]\nbroker-plugin = "0.3.0-SNAPSHOT"\n' > gradle/libs.versions.toml
	echo 'const STUBS_JAR_VERSION = process.env["STUBS_JAR_VERSION"] ?? "0.3.0-SNAPSHOT";' > ts/jar.test.ts
	git add -A
	run bash scripts/ci/check-version-drift.sh "$TMP"
	[ "$status" -eq 0 ]
	[[ "$output" == *"OK"* ]]
}

@test "version-drift: fails on a bare image literal that drifts" {
	echo 'new GenericContainer("mgrzejszczak/stubborn:0.1.0-SNAPSHOT")' > Container.java
	git add -A
	run bash scripts/ci/check-version-drift.sh "$TMP"
	[ "$status" -eq 1 ]
	[[ "$output" == *"DRIFT"* ]]
	[[ "$output" == *"0.1.0-SNAPSHOT"* ]]
}

@test "version-drift: fails on a compose fallback that drifts" {
	echo 'image: mgrzejszczak/stubborn:${STUBBORN_VERSION:-0.2.0-SNAPSHOT}' > compose.yaml
	git add -A
	run bash scripts/ci/check-version-drift.sh "$TMP"
	[ "$status" -eq 1 ]
	[[ "$output" == *"0.2.0-SNAPSHOT"* ]]
}

@test "version-drift: fails on a Gradle broker-plugin version that drifts" {
	printf '[versions]\nbroker-plugin = "0.2.0-SNAPSHOT"\n' > gradle/libs.versions.toml
	git add -A
	run bash scripts/ci/check-version-drift.sh "$TMP"
	[ "$status" -eq 1 ]
	[[ "$output" == *"broker-plugin"* ]]
	[[ "$output" == *"0.2.0-SNAPSHOT"* ]]
}

@test "version-drift: fails on a STUBS_JAR_VERSION fallback that drifts" {
	echo 'const STUBS_JAR_VERSION = process.env["STUBS_JAR_VERSION"] ?? "0.2.0-SNAPSHOT";' > ts/jar.test.ts
	git add -A
	run bash scripts/ci/check-version-drift.sh "$TMP"
	[ "$status" -eq 1 ]
	[[ "$output" == *"STUBS_JAR_VERSION"* ]]
}

@test "version-drift: ignores :latest and \${project.version} references" {
	cat > doc.md <<'M'
docker run mgrzejszczak/stubborn:latest
image: mgrzejszczak/stubborn:${project.version}
M
	git add -A
	run bash scripts/ci/check-version-drift.sh "$TMP"
	[ "$status" -eq 0 ]
}

@test "version-drift: the real repository is free of version drift" {
	run bash "$SCRIPT" "$REPO_ROOT"
	[ "$status" -eq 0 ]
	[[ "$output" == *"OK"* ]]
}
