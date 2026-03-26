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

import static org.assertj.core.api.Assertions.assertThat;

class OpenApiContractsVerifierInMemoryTest {

	private static final String OPENAPI_SPEC = """
			openapi: 3.0.1
			info:
			  title: Orders API
			  version: 1.0.0
			paths:
			  /api/orders/{id}:
			    get:
			      parameters:
			        - name: id
			          in: path
			          required: true
			          schema:
			            type: integer
			      responses:
			        '200':
			          description: OK
			  /api/orders:
			    post:
			      responses:
			        '201':
			          description: Created
			""";

	private final OpenApiContractsVerifier verifier = new OpenApiContractsVerifier();

	@Test
	void should_accept_contract_when_matching_openapi_spec() {
		// given
		String contractYaml = """
				name: should_get_order_by_id
				request:
				  method: GET
				  urlPath: /api/orders/1
				response:
				  status: 200
				""";

		// when
		OpenApiVerificationReport report = this.verifier.verifyInMemory(OPENAPI_SPEC, contractYaml);

		// then
		assertThat(report.hasViolations()).isFalse();
		assertThat(report.violations()).isEmpty();
	}

	@Test
	void should_report_violation_when_method_does_not_match() {
		// given
		String contractYaml = """
				name: should_post_order_by_id
				request:
				  method: POST
				  urlPath: /api/orders/1
				response:
				  status: 200
				""";

		// when
		OpenApiVerificationReport report = this.verifier.verifyInMemory(OPENAPI_SPEC, contractYaml);

		// then
		assertThat(report.hasViolations()).isTrue();
		assertThat(report.violations()).hasSize(1);
		assertThat(report.violations().getFirst().message()).contains("POST /api/orders/1");
	}

	@Test
	void should_report_violation_when_path_does_not_exist() {
		// given
		String contractYaml = """
				name: should_get_unknown_path
				request:
				  method: GET
				  urlPath: /api/unknown
				response:
				  status: 200
				""";

		// when
		OpenApiVerificationReport report = this.verifier.verifyInMemory(OPENAPI_SPEC, contractYaml);

		// then
		assertThat(report.hasViolations()).isTrue();
		assertThat(report.violations()).hasSize(1);
		assertThat(report.violations().getFirst().message()).contains("No OpenAPI path matches");
	}

	@Test
	void should_report_violation_when_status_code_not_defined() {
		// given
		String contractYaml = """
				name: should_get_order_404
				request:
				  method: GET
				  urlPath: /api/orders/1
				response:
				  status: 404
				""";

		// when
		OpenApiVerificationReport report = this.verifier.verifyInMemory(OPENAPI_SPEC, contractYaml);

		// then
		assertThat(report.hasViolations()).isTrue();
		assertThat(report.violations()).hasSize(1);
		assertThat(report.violations().getFirst().message()).contains("No OpenAPI response status 404");
	}

	@Test
	void should_report_violation_when_openapi_spec_is_invalid() {
		// given
		String invalidSpec = "not valid openapi yaml at all: [[[";
		String contractYaml = """
				name: any_contract
				request:
				  method: GET
				  urlPath: /foo
				response:
				  status: 200
				""";

		// when
		OpenApiVerificationReport report = this.verifier.verifyInMemory(invalidSpec, contractYaml);

		// then
		assertThat(report.hasViolations()).isTrue();
	}

}
