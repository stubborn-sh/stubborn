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

import java.net.URISyntaxException;
import java.nio.file.Path;

import static org.assertj.core.api.Assertions.assertThat;

class OpenApiContractsVerifierTest {

	@Test
	void should_report_all_contract_mismatches_when_contracts_do_not_match_openapi() throws Exception {
		// given
		Path openApiSpec = resourcePath("openapi/verify_contract_validation.yml");
		Path contractsDir = resourcePath("contracts/validation/invalid");
		OpenApiContractsVerifier verifier = new OpenApiContractsVerifier();

		// when
		OpenApiVerificationReport report = verifier.verify(openApiSpec, contractsDir);

		// then
		assertThat(report.hasViolations()).isTrue();
		assertThat(report.violations()).hasSize(2);
		assertThat(report.render()).contains("POST /foo");
		assertThat(report.render()).contains("POST /bar/123");
	}

	@Test
	void should_accept_all_contracts_when_contracts_match_openapi() throws Exception {
		// given
		Path openApiSpec = resourcePath("openapi/verify_contract_validation.yml");
		Path contractsDir = resourcePath("contracts/validation/valid");
		OpenApiContractsVerifier verifier = new OpenApiContractsVerifier();

		// when
		OpenApiVerificationReport report = verifier.verify(openApiSpec, contractsDir);

		// then
		assertThat(report.hasViolations()).isFalse();
		assertThat(report.violations()).isEmpty();
	}

	private static Path resourcePath(String resource) throws URISyntaxException {
		return Path.of(OpenApiContractsVerifierTest.class.getClassLoader().getResource(resource).toURI());
	}

}
