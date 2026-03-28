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

import java.util.Set;

import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Validates the {@code @Size(max = 1048576)} constraint on
 * {@link CreateContractRequest#content()}, ensuring contract content cannot exceed 1MB.
 *
 * @see CreateContractRequest
 * @see <a href="docs/specs/038-security-hardening.md">Spec 038</a>
 */
class ContractContentSizeTest {

	private final Validator validator = Validation.buildDefaultValidatorFactory().getValidator();

	@Test
	void should_accept_content_within_1mb_limit() {
		// given - exactly 1MB content
		String content = "x".repeat(1_048_576);
		CreateContractRequest request = new CreateContractRequest("test-contract", content, "application/json", null);

		// when
		Set<ConstraintViolation<CreateContractRequest>> violations = this.validator.validate(request);

		// then
		assertThat(violations).filteredOn(v -> v.getPropertyPath().toString().equals("content")).isEmpty();
	}

	@Test
	void should_reject_content_exceeding_1mb_limit() {
		// given - content > 1MB (1,048,577 bytes)
		String oversizedContent = "x".repeat(1_048_577);
		CreateContractRequest request = new CreateContractRequest("test-contract", oversizedContent, "application/json",
				null);

		// when
		Set<ConstraintViolation<CreateContractRequest>> violations = this.validator.validate(request);

		// then
		assertThat(violations).filteredOn(v -> v.getPropertyPath().toString().equals("content")).isNotEmpty();
	}

}
