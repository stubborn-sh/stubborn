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
package org.springframework.cloud.contract.broker.environment;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class EnvironmentNameTest {

	@ParameterizedTest
	@ValueSource(strings = { "dev", "staging", "production", "qa", "us-east-1", "test-env-2", "a", "abc123" })
	void should_accept_valid_environment_names(String name) {
		// when
		EnvironmentName result = EnvironmentName.of(name);
		// then
		assertThat(result.value()).isEqualTo(name);
	}

	@ParameterizedTest
	@ValueSource(
			strings = { "-dev", "dev-", "-", "DEV", "Dev", "test_env", "test env", "test.env", "dev@1", "PRODUCTION" })
	void should_reject_invalid_environment_names(String name) {
		assertThatThrownBy(() -> EnvironmentName.of(name)).isInstanceOf(IllegalArgumentException.class);
	}

	@Test
	void should_reject_blank_name() {
		assertThatThrownBy(() -> EnvironmentName.of("")).isInstanceOf(IllegalArgumentException.class)
			.hasMessageContaining("must not be blank");
	}

	@Test
	@SuppressWarnings("NullAway")
	void should_reject_null_name() {
		assertThatThrownBy(() -> EnvironmentName.of(null)).isInstanceOf(IllegalArgumentException.class)
			.hasMessageContaining("must not be blank");
	}

	@Test
	void should_reject_name_exceeding_max_length() {
		String longName = "a".repeat(65);
		assertThatThrownBy(() -> EnvironmentName.of(longName)).isInstanceOf(IllegalArgumentException.class)
			.hasMessageContaining("must not exceed");
	}

}
