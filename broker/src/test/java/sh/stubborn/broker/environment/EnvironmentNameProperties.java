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
package sh.stubborn.broker.environment;

import net.jqwik.api.Arbitraries;
import net.jqwik.api.Arbitrary;
import net.jqwik.api.ForAll;
import net.jqwik.api.Property;
import net.jqwik.api.Provide;
import net.jqwik.api.constraints.IntRange;
import net.jqwik.api.constraints.StringLength;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class EnvironmentNameProperties {

	@Property
	void should_roundtrip_valid_names(@ForAll("validNames") String name) {
		// given/when
		EnvironmentName result = EnvironmentName.of(name);

		// then
		assertThat(result.value()).isEqualTo(name);
	}

	@Property
	void should_never_accept_names_with_leading_hyphens(@ForAll("validNames") String base) {
		// given
		String name = "-" + base;

		// when/then
		assertThatThrownBy(() -> EnvironmentName.of(name)).isInstanceOf(IllegalArgumentException.class);
	}

	@Property
	void should_never_accept_names_with_trailing_hyphens(@ForAll("validNames") String base) {
		// given
		String name = base + "-";

		// when/then
		assertThatThrownBy(() -> EnvironmentName.of(name)).isInstanceOf(IllegalArgumentException.class);
	}

	@Property
	void should_have_consistent_equality(@ForAll("validNames") String name) {
		// given
		EnvironmentName a = EnvironmentName.of(name);
		EnvironmentName b = EnvironmentName.of(name);

		// then
		assertThat(a).isEqualTo(b);
		assertThat(a.hashCode()).isEqualTo(b.hashCode());
	}

	@Property
	void should_reject_names_exceeding_max_length(
			@ForAll @StringLength(min = 65, max = 200) @net.jqwik.api.constraints.LowerChars String name) {
		assertThatThrownBy(() -> EnvironmentName.of(name)).isInstanceOf(IllegalArgumentException.class);
	}

	@Provide
	Arbitrary<String> validNames() {
		return Arbitraries.strings()
			.withCharRange('a', 'z')
			.withCharRange('0', '9')
			.ofMinLength(1)
			.ofMaxLength(63)
			.filter(s -> !s.startsWith("-") && !s.endsWith("-"));
	}

}
