#!/usr/bin/env bats
# Tests for scripts/release/set-project-versions.sh
#
# The script rewrites the non-Maven version references. These tests build a throwaway
# repo layout with just those files and assert the exact rewritten content for both the
# release bump and the next-snapshot bump.

setup() {
	REPO_ROOT="$(cd "$BATS_TEST_DIRNAME/../.." && pwd)"
	SCRIPT="$REPO_ROOT/scripts/release/set-project-versions.sh"
	TMP="$(mktemp -d)"
	mkdir -p "$TMP/charts/stubborn-broker" "$TMP/broker-gradle-plugin/gradle" "$TMP/samples"
	cat > "$TMP/charts/stubborn-broker/Chart.yaml" <<'CHART'
apiVersion: v2
name: stubborn-broker
version: 0.1.0
appVersion: "0.1.0-SNAPSHOT"
CHART
	echo "version = '0.1.0-SNAPSHOT'" > "$TMP/broker-gradle-plugin/build.gradle"
	echo 'broker-publisher = "0.1.0-SNAPSHOT"' > "$TMP/broker-gradle-plugin/gradle/libs.versions.toml"
	cat > "$TMP/samples/compose.yaml" <<'COMPOSE'
services:
  broker:
    image: mgrzejszczak/stubborn:${STUBBORN_VERSION:-0.1.0-SNAPSHOT}
  proxy:
    image: mgrzejszczak/stubborn-proxy:${STUBBORN_VERSION:-0.1.0-SNAPSHOT}
COMPOSE
}

teardown() {
	rm -rf "$TMP"
}

@test "set-project-versions: release bump writes plain version everywhere" {
	cd "$TMP"
	run "$SCRIPT" "0.0.1"
	[ "$status" -eq 0 ]
	grep -q "^version: 0.0.1$" charts/stubborn-broker/Chart.yaml
	grep -q '^appVersion: "0.0.1"$' charts/stubborn-broker/Chart.yaml
	grep -q "^version = '0.0.1'$" broker-gradle-plugin/build.gradle
	grep -q '^broker-publisher = "0.0.1"$' broker-gradle-plugin/gradle/libs.versions.toml
	grep -q 'image: mgrzejszczak/stubborn:${STUBBORN_VERSION:-0.0.1}$' samples/compose.yaml
	grep -q 'image: mgrzejszczak/stubborn-proxy:${STUBBORN_VERSION:-0.0.1}$' samples/compose.yaml
}

@test "set-project-versions: snapshot bump strips -SNAPSHOT only from chart version" {
	cd "$TMP"
	run "$SCRIPT" "0.2.0-SNAPSHOT"
	[ "$status" -eq 0 ]
	# Chart version: is plain SemVer (no -SNAPSHOT)
	grep -q "^version: 0.2.0$" charts/stubborn-broker/Chart.yaml
	# appVersion and the Gradle refs keep the full -SNAPSHOT value
	grep -q '^appVersion: "0.2.0-SNAPSHOT"$' charts/stubborn-broker/Chart.yaml
	grep -q "^version = '0.2.0-SNAPSHOT'$" broker-gradle-plugin/build.gradle
	grep -q '^broker-publisher = "0.2.0-SNAPSHOT"$' broker-gradle-plugin/gradle/libs.versions.toml
	# Compose defaults keep the full -SNAPSHOT value for both images
	grep -q 'image: mgrzejszczak/stubborn:${STUBBORN_VERSION:-0.2.0-SNAPSHOT}$' samples/compose.yaml
	grep -q 'image: mgrzejszczak/stubborn-proxy:${STUBBORN_VERSION:-0.2.0-SNAPSHOT}$' samples/compose.yaml
}

@test "set-project-versions: pre-release (RC) is kept verbatim in chart version" {
	cd "$TMP"
	run "$SCRIPT" "1.0.0-RC1"
	[ "$status" -eq 0 ]
	grep -q "^version: 1.0.0-RC1$" charts/stubborn-broker/Chart.yaml
	grep -q '^appVersion: "1.0.0-RC1"$' charts/stubborn-broker/Chart.yaml
}

@test "set-project-versions: fails with usage when no argument" {
	cd "$TMP"
	run "$SCRIPT"
	[ "$status" -ne 0 ]
}
