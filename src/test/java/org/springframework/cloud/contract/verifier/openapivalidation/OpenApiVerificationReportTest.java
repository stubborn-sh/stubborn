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

package org.springframework.cloud.contract.verifier.openapivalidation;

import org.junit.jupiter.api.Test;

import java.nio.file.Path;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class OpenApiVerificationReportTest {

	@Test
	void should_render_success_message_when_no_violations() {
		// given
		OpenApiVerificationReport report = new OpenApiVerificationReport(List.of());

		// when
		String rendered = report.render();

		// then
		assertThat(rendered).isEqualTo("✅ All contracts match the OpenAPI specification.");
	}

	@Test
	void should_render_all_violations_in_report() {
		// given
		OpenApiContractViolation first = new OpenApiContractViolation(Path.of("contracts/contract-a.yml"), "contract-a",
				"No OpenAPI path matches contract request GET /foo");
		OpenApiContractViolation second = new OpenApiContractViolation(Path.of("contracts/contract-b.yml"),
				"contract-b", "No OpenAPI response status 200 for contract request POST /bar");
		OpenApiVerificationReport report = new OpenApiVerificationReport(List.of(first, second));

		// when
		String rendered = report.render();

		// then
		assertThat(rendered).contains("❌ Found 2 contract violations:");
		assertThat(rendered).contains("1) contract-a - No OpenAPI path matches contract request GET /foo");
		assertThat(rendered).contains("contract-a.yml");
		assertThat(rendered).contains("2) contract-b - No OpenAPI response status 200 for contract request POST /bar");
		assertThat(rendered).contains("contract-b.yml");
	}

}
