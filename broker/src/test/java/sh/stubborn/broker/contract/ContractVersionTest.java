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

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ContractVersionTest {

	@ParameterizedTest
	@ValueSource(strings = { "1.0.0", "2.1.3", "0.0.1", "10.20.30", "1.0.0-SNAPSHOT", "1.0.0-beta.1", "1.0.0-rc.1",
			"1.0.0+build.123" })
	void should_accept_valid_semantic_versions(String version) {
		// when
		ContractVersion result = ContractVersion.of(version);
		// then
		assertThat(result.value()).isEqualTo(version);
	}

	@ParameterizedTest
	@ValueSource(strings = { "1.0", "1", "abc", "1.0.0-", "1.0.0--bad", ".1.0.0", "v1.0.0" })
	void should_reject_invalid_versions(String version) {
		assertThatThrownBy(() -> ContractVersion.of(version)).isInstanceOf(IllegalArgumentException.class);
	}

	@Test
	void should_reject_blank_version() {
		assertThatThrownBy(() -> ContractVersion.of("")).isInstanceOf(IllegalArgumentException.class)
			.hasMessageContaining("must not be blank");
	}

	@Test
	void should_reject_version_exceeding_max_length() {
		String longVersion = "1.0.0-" + "a".repeat(60);
		assertThatThrownBy(() -> ContractVersion.of(longVersion)).isInstanceOf(IllegalArgumentException.class)
			.hasMessageContaining("must not exceed");
	}

}
