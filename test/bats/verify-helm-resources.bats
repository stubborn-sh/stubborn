#!/usr/bin/env bats
# Tests for scripts/ci/verify-helm-resources.sh

setup() {
	REPO_ROOT="$(cd "$BATS_TEST_DIRNAME/../.." && pwd)"
	SCRIPT="$REPO_ROOT/scripts/ci/verify-helm-resources.sh"
}

@test "verify-helm-resources: passes when all kinds present" {
	run bash -c "manifest() { cat <<'YAML'
kind: ServiceAccount
kind: ConfigMap
kind: Service
kind: Deployment
YAML
}; manifest | '$SCRIPT'"
	[ "$status" -eq 0 ]
	[[ "$output" == *"All key resources present"* ]]
}

@test "verify-helm-resources: fails when Deployment missing" {
	run bash -c "printf 'kind: ServiceAccount\nkind: ConfigMap\nkind: Service\n' | '$SCRIPT'"
	[ "$status" -ne 0 ]
	[[ "$output" == *"Missing Deployment"* ]]
}

@test "verify-helm-resources: fails when Service missing" {
	# NOTE: the check is a plain substring `grep -q "kind: Service"`, carried over verbatim
	# from ci.yml. "kind: ServiceAccount" therefore satisfies the Service check, so a
	# genuinely-missing-Service manifest must also omit ServiceAccount for the check to trip.
	run bash -c "printf 'kind: ConfigMap\nkind: Deployment\n' | '$SCRIPT'"
	[ "$status" -ne 0 ]
	[[ "$output" == *"Missing Service"* ]]
}

@test "verify-helm-resources: ServiceAccount substring satisfies the Service check (behavior preserved from ci.yml)" {
	# Documents the quirk above: with ServiceAccount but no standalone Service, the Service
	# grep still matches. The manifest below has every required kind except a standalone
	# Service, yet passes — exactly as the original inline workflow logic did.
	run bash -c "printf 'kind: ServiceAccount\nkind: ConfigMap\nkind: Deployment\n' | '$SCRIPT'"
	[ "$status" -eq 0 ]
	[[ "$output" == *"All key resources present"* ]]
}

@test "verify-helm-resources: fails when ConfigMap missing" {
	run bash -c "printf 'kind: ServiceAccount\nkind: Service\nkind: Deployment\n' | '$SCRIPT'"
	[ "$status" -ne 0 ]
	[[ "$output" == *"Missing ConfigMap"* ]]
}

@test "verify-helm-resources: fails when ServiceAccount missing" {
	run bash -c "printf 'kind: ConfigMap\nkind: Service\nkind: Deployment\n' | '$SCRIPT'"
	[ "$status" -ne 0 ]
	[[ "$output" == *"Missing ServiceAccount"* ]]
}
