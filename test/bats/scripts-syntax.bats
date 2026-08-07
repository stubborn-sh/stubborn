#!/usr/bin/env bats
# Syntax check for every shell script under scripts/.
#
# Guarantees that even the scripts which mostly orchestrate external tools (and so carry
# little unit-testable logic) are at least parsed by bash on every CI run.

setup() {
	REPO_ROOT="$(cd "$BATS_TEST_DIRNAME/../.." && pwd)"
}

@test "all scripts under scripts/ pass 'bash -n'" {
	local failed=0
	while IFS= read -r -d '' script; do
		if ! bash -n "$script"; then
			echo "syntax error in: $script"
			failed=1
		fi
	done < <(find "$REPO_ROOT/scripts" -name '*.sh' -print0)
	[ "$failed" -eq 0 ]
}

@test "all scripts under scripts/ start with a bash shebang" {
	local failed=0
	while IFS= read -r -d '' script; do
		if ! head -1 "$script" | grep -q '^#!/usr/bin/env bash'; then
			echo "missing bash shebang: $script"
			failed=1
		fi
	done < <(find "$REPO_ROOT/scripts" -name '*.sh' -print0)
	[ "$failed" -eq 0 ]
}
