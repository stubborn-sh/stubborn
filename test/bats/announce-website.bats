#!/usr/bin/env bats
# Tests for scripts/release/announce-website.sh

setup() {
	REPO_ROOT="$(cd "$BATS_TEST_DIRNAME/../.." && pwd)"
	SCRIPT="$REPO_ROOT/scripts/release/announce-website.sh"
	TMP="$(mktemp -d)"

	# Stub gh: records how it was called and what body it was given.
	cat >"$TMP/gh" <<-'STUB'
		#!/usr/bin/env bash
		printf '%s\n' "$*" >"$GH_ARGS_FILE"
		cat >"$GH_BODY_FILE"
		exit "${GH_EXIT:-0}"
	STUB
	chmod +x "$TMP/gh"

	export GH="$TMP/gh"
	export GH_ARGS_FILE="$TMP/args"
	export GH_BODY_FILE="$TMP/body"
}

teardown() {
	rm -rf "$TMP"
}

@test "announce-website: dispatches release-published with repo and tag" {
	GH_TOKEN=token run "$SCRIPT" stubborn 0.1.2
	[ "$status" -eq 0 ]

	grep -q "repos/stubborn-sh/stubborn-website/dispatches" "$GH_ARGS_FILE"
	grep -q -- "--method POST" "$GH_ARGS_FILE"
	[ "$(jq -r '.event_type' "$GH_BODY_FILE")" = "release-published" ]
	[ "$(jq -r '.client_payload.repo' "$GH_BODY_FILE")" = "stubborn" ]
	[ "$(jq -r '.client_payload.tag' "$GH_BODY_FILE")" = "v0.1.2" ]
}

@test "announce-website: accepts a version that already carries the v prefix" {
	GH_TOKEN=token run "$SCRIPT" stubborn v0.1.2
	[ "$status" -eq 0 ]
	[ "$(jq -r '.client_payload.tag' "$GH_BODY_FILE")" = "v0.1.2" ]
}

@test "announce-website: honours WEBSITE_REPO" {
	GH_TOKEN=token WEBSITE_REPO=acme/site run "$SCRIPT" stubborn 0.1.2
	[ "$status" -eq 0 ]
	grep -q "repos/acme/site/dispatches" "$GH_ARGS_FILE"
}

@test "announce-website: skips quietly when no token is configured" {
	run env -u GH_TOKEN "$SCRIPT" stubborn 0.1.2
	[ "$status" -eq 0 ]
	[[ "$output" == *"skipping the stubborn.sh announcement"* ]]
	[ ! -f "$GH_ARGS_FILE" ]
}

@test "announce-website: a failed dispatch never fails the release" {
	GH_TOKEN=token GH_EXIT=1 run "$SCRIPT" stubborn 0.1.2
	[ "$status" -eq 0 ]
	[[ "$output" == *"scheduled sweep will pick it up"* ]]
}

@test "announce-website: requires a repo and a version" {
	GH_TOKEN=token run "$SCRIPT"
	[ "$status" -ne 0 ]

	GH_TOKEN=token run "$SCRIPT" stubborn
	[ "$status" -ne 0 ]
}
