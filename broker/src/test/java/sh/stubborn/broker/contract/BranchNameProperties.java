/*
 * Copyright 2026-present the original author or authors.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
package sh.stubborn.broker.contract;

import net.jqwik.api.Arbitraries;
import net.jqwik.api.Arbitrary;
import net.jqwik.api.ForAll;
import net.jqwik.api.Property;
import net.jqwik.api.Provide;
import net.jqwik.api.constraints.IntRange;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class BranchNameProperties {

	@Property
	void should_roundtrip_valid_branch_names(@ForAll("validBranchNames") String value) {
		// when
		BranchName name = BranchName.of(value);

		// then
		assertThat(name.value()).isEqualTo(value);
	}

	@Property
	void should_have_consistent_equality(@ForAll("validBranchNames") String value) {
		// when
		BranchName name1 = BranchName.of(value);
		BranchName name2 = BranchName.of(value);

		// then
		assertThat(name1).isEqualTo(name2);
		assertThat(name1.hashCode()).isEqualTo(name2.hashCode());
	}

	@Property
	void should_reject_names_exceeding_max_length(@ForAll @IntRange(min = 129, max = 300) int length) {
		// given
		String value = "a".repeat(length);

		// then
		assertThatThrownBy(() -> BranchName.of(value)).isInstanceOf(IllegalArgumentException.class)
			.hasMessageContaining("128");
	}

	@Property
	void should_accept_git_style_branch_names(@ForAll("gitBranchNames") String value) {
		// when
		BranchName name = BranchName.of(value);

		// then
		assertThat(name.value()).isEqualTo(value);
	}

	@Provide
	Arbitrary<String> validBranchNames() {
		return Arbitraries.strings()
			.ofMinLength(1)
			.ofMaxLength(128)
			.withChars("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/_.-".toCharArray())
			.filter(s -> !s.isEmpty() && Character.isLetterOrDigit(s.charAt(0))
					&& Character.isLetterOrDigit(s.charAt(s.length() - 1)));
	}

	@Provide
	Arbitrary<String> gitBranchNames() {
		return Arbitraries.of("main", "develop", "feature/add-login", "release/1.0.0", "hotfix/fix-crash",
				"feat/PROJ-123.my-feature", "v1.2.3", "refs/heads/main");
	}

}
