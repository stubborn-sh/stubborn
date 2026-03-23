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
import net.jqwik.api.Combinators;
import net.jqwik.api.ForAll;
import net.jqwik.api.Property;
import net.jqwik.api.Provide;

import static org.assertj.core.api.Assertions.assertThat;

class ContractVersionProperties {

	@Property
	void should_accept_all_valid_semver_versions(@ForAll("validVersions") String version) {
		// when
		ContractVersion result = ContractVersion.of(version);
		// then
		assertThat(result.value()).isEqualTo(version);
	}

	@Property
	void should_preserve_value_on_roundtrip(@ForAll("validVersions") String version) {
		// when
		ContractVersion v1 = ContractVersion.of(version);
		ContractVersion v2 = ContractVersion.of(v1.value());
		// then
		assertThat(v1).isEqualTo(v2);
	}

	@Provide
	Arbitrary<String> validVersions() {
		Arbitrary<Integer> major = Arbitraries.integers().between(0, 99);
		Arbitrary<Integer> minor = Arbitraries.integers().between(0, 99);
		Arbitrary<Integer> patch = Arbitraries.integers().between(0, 99);
		return Combinators.combine(major, minor, patch).as((a, b, c) -> a + "." + b + "." + c);
	}

}
