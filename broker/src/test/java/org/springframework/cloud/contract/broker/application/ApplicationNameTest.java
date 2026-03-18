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

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ApplicationNameTest {

	@ParameterizedTest
	@ValueSource(strings = { "a", "order-service", "OrderService", "my-app-123", "A1", "abc" })
	void should_create_valid_name(String value) {
		// when
		ApplicationName name = ApplicationName.of(value);

		// then
		assertThat(name.value()).isEqualTo(value);
	}

	@ParameterizedTest
	@NullAndEmptySource
	@ValueSource(
			strings = { " ", "-invalid", "invalid-", "-", "--", "has space", "has.dot", "has/slash", "has@symbol" })
	void should_reject_invalid_name(String value) {
		assertThatThrownBy(() -> ApplicationName.of(value)).isInstanceOf(IllegalArgumentException.class);
	}

	@Test
	void should_reject_name_exceeding_max_length() {
		// given
		String tooLong = "a".repeat(129);

		// then
		assertThatThrownBy(() -> ApplicationName.of(tooLong)).isInstanceOf(IllegalArgumentException.class)
			.hasMessageContaining("128");
	}

	@Test
	void should_accept_name_at_max_length() {
		// given
		String atMax = "a".repeat(128);

		// when
		ApplicationName name = ApplicationName.of(atMax);

		// then
		assertThat(name.value()).hasSize(128);
	}

	@Test
	void should_have_value_equality() {
		// given
		ApplicationName name1 = ApplicationName.of("order-service");
		ApplicationName name2 = ApplicationName.of("order-service");

		// then
		assertThat(name1).isEqualTo(name2);
		assertThat(name1.hashCode()).isEqualTo(name2.hashCode());
	}

	@Test
	void should_display_value_in_toString() {
		// given
		ApplicationName name = ApplicationName.of("order-service");

		// then
		assertThat(name.toString()).contains("order-service");
	}

}
