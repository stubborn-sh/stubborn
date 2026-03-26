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

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import java.net.URISyntaxException;
import java.nio.file.Path;
import static org.assertj.core.api.Assertions.assertThat;

class OpenApiContractsVerifierMatrixTest {

	private final OpenApiContractsVerifier verifier = new OpenApiContractsVerifier();

	@ParameterizedTest(name = "spec={0}, contracts={1}")
	@CsvSource(textBlock = """
			openapi/verify_contract_validation.yml, contracts/validation_matrix/yml/valid
			openapi/verify_contract_validation.yml, contracts/validation_matrix/groovy/valid
			openapi/verify_contract_validation.yml, contracts/validation_matrix/java/valid
			openapi/verify_contract_validation.json, contracts/validation_matrix/yml/valid
			openapi/verify_contract_validation.json, contracts/validation_matrix/groovy/valid
			openapi/verify_contract_validation.json, contracts/validation_matrix/java/valid
			""")
	void should_accept_contracts_when_openapi_and_contract_formats_match(String openApiSpec, String contractsDir)
			throws Exception {
		// given
		Path specPath = resourcePath(openApiSpec);
		Path contractsPath = resourcePath(contractsDir);

		// when
		OpenApiVerificationReport report = verifier.verify(specPath, contractsPath);

		// then
		assertThat(report.hasViolations()).isFalse();
		assertThat(report.violations()).isEmpty();
	}

	@ParameterizedTest(name = "spec={0}, contracts={1}")
	@CsvSource(textBlock = """
			openapi/verify_contract_validation.yml, contracts/validation_matrix/yml/invalid
			openapi/verify_contract_validation.yml, contracts/validation_matrix/groovy/invalid
			openapi/verify_contract_validation.json, contracts/validation_matrix/yml/invalid
			openapi/verify_contract_validation.json, contracts/validation_matrix/groovy/invalid
			""")
	void should_report_violations_when_openapi_and_contract_formats_do_not_match(String openApiSpec,
			String contractsDir) throws Exception {
		// given
		Path specPath = resourcePath(openApiSpec);
		Path contractsPath = resourcePath(contractsDir);

		// when
		OpenApiVerificationReport report = verifier.verify(specPath, contractsPath);

		// then
		assertThat(report.hasViolations()).isTrue();
		assertThat(report.violations()).hasSize(2);
	}

	private static Path resourcePath(String resource) throws URISyntaxException {
		return Path.of(OpenApiContractsVerifierMatrixTest.class.getClassLoader().getResource(resource).toURI());
	}

}
