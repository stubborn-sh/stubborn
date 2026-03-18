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
package org.springframework.cloud.contract.broker.application;

import net.jqwik.api.Arbitraries;
import net.jqwik.api.Arbitrary;
import net.jqwik.api.ForAll;
import net.jqwik.api.Property;
import net.jqwik.api.Provide;
import net.jqwik.api.constraints.IntRange;
import net.jqwik.api.constraints.StringLength;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ApplicationNameProperties {

	@Property
	void should_roundtrip_valid_names(@ForAll("validNames") String value) {
		// when
		ApplicationName name = ApplicationName.of(value);

		// then
		assertThat(name.value()).isEqualTo(value);
	}

	@Property
	void should_never_accept_names_with_leading_hyphens(@ForAll @StringLength(min = 1, max = 127) String suffix) {
		// given
		String value = "-" + suffix.replaceAll("[^a-zA-Z0-9-]", "a");

		// then
		assertThatThrownBy(() -> ApplicationName.of(value)).isInstanceOf(IllegalArgumentException.class);
	}

	@Property
	void should_never_accept_names_with_trailing_hyphens(@ForAll @StringLength(min = 1, max = 127) String prefix) {
		// given
		String value = prefix.replaceAll("[^a-zA-Z0-9-]", "a") + "-";

		// then
		assertThatThrownBy(() -> ApplicationName.of(value)).isInstanceOf(IllegalArgumentException.class);
	}

	@Property
	void should_have_consistent_equality(@ForAll("validNames") String value) {
		// when
		ApplicationName name1 = ApplicationName.of(value);
		ApplicationName name2 = ApplicationName.of(value);

		// then
		assertThat(name1).isEqualTo(name2);
		assertThat(name1.hashCode()).isEqualTo(name2.hashCode());
	}

	@Property
	void should_reject_names_exceeding_max_length(@ForAll @IntRange(min = 129, max = 300) int length) {
		// given
		String value = "a".repeat(length);

		// then
		assertThatThrownBy(() -> ApplicationName.of(value)).isInstanceOf(IllegalArgumentException.class);
	}

	@Provide
	Arbitrary<String> validNames() {
		return Arbitraries.strings()
			.ofMinLength(1)
			.ofMaxLength(128)
			.withChars("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-".toCharArray())
			.filter(s -> !s.startsWith("-") && !s.endsWith("-"));
	}

}
