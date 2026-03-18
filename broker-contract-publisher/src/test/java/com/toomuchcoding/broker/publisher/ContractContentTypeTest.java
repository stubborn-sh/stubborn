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
package com.toomuchcoding.broker.publisher;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class ContractContentTypeTest {

	@Test
	void should_return_yaml_content_type_when_yaml_extension() {
		assertThat(ContractContentType.fromExtension("get-order.yaml")).isEqualTo(ContractContentType.YAML);
	}

	@Test
	void should_return_yaml_content_type_when_yml_extension() {
		assertThat(ContractContentType.fromExtension("get-order.yml")).isEqualTo(ContractContentType.YAML);
	}

	@Test
	void should_return_groovy_content_type_when_groovy_extension() {
		assertThat(ContractContentType.fromExtension("create-order.groovy")).isEqualTo(ContractContentType.GROOVY);
	}

	@Test
	void should_return_json_content_type_when_json_extension() {
		assertThat(ContractContentType.fromExtension("delete-order.json")).isEqualTo(ContractContentType.JSON);
	}

	@Test
	void should_return_null_when_unsupported_extension() {
		assertThat(ContractContentType.fromExtension("readme.txt")).isNull();
	}

	@Test
	void should_handle_uppercase_extensions() {
		assertThat(ContractContentType.fromExtension("Order.YAML")).isEqualTo(ContractContentType.YAML);
	}

	@Test
	void should_strip_extension_from_filename() {
		assertThat(ContractContentType.stripExtension("get-order.yaml")).isEqualTo("get-order");
	}

	@Test
	void should_strip_extension_from_groovy_filename() {
		assertThat(ContractContentType.stripExtension("create-order.groovy")).isEqualTo("create-order");
	}

	@Test
	void should_return_filename_when_no_extension() {
		assertThat(ContractContentType.stripExtension("noextension")).isEqualTo("noextension");
	}

}
