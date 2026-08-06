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
package sh.stubborn.oss.contract;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * @see sh.stubborn.oss.contract.ContractContentTypes
 */
class ContractContentTypesTest {

	@Test
	void should_recognize_spring_cloud_contract_yaml_as_yaml() {
		assertThat(ContractContentTypes.isYaml(ContractContentTypes.SPRING_CLOUD_CONTRACT_YAML)).isTrue();
		assertThat(ContractContentTypes.isYaml("application/x-spring-cloud-contract+yaml")).isTrue();
	}

	@Test
	void should_recognize_stubborn_native_yaml_as_yaml() {
		assertThat(ContractContentTypes.isYaml(ContractContentTypes.STUBBORN_YAML)).isTrue();
		assertThat(ContractContentTypes.isYaml("application/x-stubborn+yaml")).isTrue();
	}

	@Test
	void should_expose_both_aliases_in_the_yaml_set() {
		assertThat(ContractContentTypes.YAML).containsExactlyInAnyOrder("application/x-spring-cloud-contract+yaml",
				"application/x-stubborn+yaml");
	}

	@Test
	void should_match_case_insensitively() {
		assertThat(ContractContentTypes.isYaml("APPLICATION/X-STUBBORN+YAML")).isTrue();
		assertThat(ContractContentTypes.isYaml("Application/X-Spring-Cloud-Contract+Yaml")).isTrue();
	}

	@Test
	void should_not_recognize_other_content_types_as_yaml() {
		assertThat(ContractContentTypes.isYaml("application/json")).isFalse();
		assertThat(ContractContentTypes.isYaml("application/x-yaml")).isFalse();
		assertThat(ContractContentTypes.isYaml("application/x-spring-cloud-contract+groovy")).isFalse();
		assertThat(ContractContentTypes.isYaml(null)).isFalse();
	}

}
