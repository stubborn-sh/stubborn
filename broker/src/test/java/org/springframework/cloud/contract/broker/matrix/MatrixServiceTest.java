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
package org.springframework.cloud.contract.broker.matrix;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import org.springframework.cloud.contract.broker.application.ApplicationService;
import org.springframework.cloud.contract.broker.verification.VerificationInfo;
import org.springframework.cloud.contract.broker.verification.VerificationService;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.BDDMockito.given;

@ExtendWith(MockitoExtension.class)
class MatrixServiceTest {

	@Mock
	VerificationService verificationService;

	@Mock
	ApplicationService applicationService;

	MatrixService matrixService;

	private final UUID providerId = UUID.randomUUID();

	private final UUID consumerId = UUID.randomUUID();

	@BeforeEach
	void setUp() {
		this.matrixService = new MatrixService(this.verificationService, this.applicationService);
	}

	@Test
	void should_return_all_entries_when_no_filter() {
		// given
		given(this.verificationService.findAllInfo()).willReturn(List.of(new VerificationInfo(this.providerId, "1.0.0",
				this.consumerId, "2.0.0", "SUCCESS", "main", Instant.parse("2026-01-15T10:00:00Z"))));
		given(this.applicationService.findNameById(this.providerId)).willReturn("order-service");
		given(this.applicationService.findNameById(this.consumerId)).willReturn("payment-service");

		// when
		List<MatrixEntry> result = this.matrixService.query(null, null);

		// then
		assertThat(result).hasSize(1);
		assertThat(result.get(0).providerName()).isEqualTo("order-service");
		assertThat(result.get(0).consumerName()).isEqualTo("payment-service");
		assertThat(result.get(0).status()).isEqualTo("SUCCESS");
		assertThat(result.get(0).branch()).isEqualTo("main");
	}

	@Test
	void should_filter_by_provider_name() {
		// given
		given(this.verificationService.findAllInfo()).willReturn(List.of(new VerificationInfo(this.providerId, "1.0.0",
				this.consumerId, "2.0.0", "SUCCESS", null, Instant.parse("2026-01-15T10:00:00Z"))));
		given(this.applicationService.findNameById(this.providerId)).willReturn("order-service");

		// when
		List<MatrixEntry> result = this.matrixService.query("order-service", null);

		// then
		assertThat(result).hasSize(1);
	}

	@Test
	void should_exclude_non_matching_provider() {
		// given
		given(this.verificationService.findAllInfo()).willReturn(List.of(new VerificationInfo(this.providerId, "1.0.0",
				this.consumerId, "2.0.0", "SUCCESS", null, Instant.parse("2026-01-15T10:00:00Z"))));
		given(this.applicationService.findNameById(this.providerId)).willReturn("order-service");

		// when
		List<MatrixEntry> result = this.matrixService.query("other-service", null);

		// then
		assertThat(result).isEmpty();
	}

	@Test
	void should_filter_by_consumer_name() {
		// given
		given(this.verificationService.findAllInfo()).willReturn(List.of(new VerificationInfo(this.providerId, "1.0.0",
				this.consumerId, "2.0.0", "FAILED", null, Instant.parse("2026-01-15T10:00:00Z"))));
		given(this.applicationService.findNameById(this.providerId)).willReturn("order-service");
		given(this.applicationService.findNameById(this.consumerId)).willReturn("payment-service");

		// when
		List<MatrixEntry> result = this.matrixService.query(null, "payment-service");

		// then
		assertThat(result).hasSize(1);
		assertThat(result.get(0).status()).isEqualTo("FAILED");
	}

	@Test
	void should_return_empty_when_no_verifications() {
		// given
		given(this.verificationService.findAllInfo()).willReturn(List.of());

		// when
		List<MatrixEntry> result = this.matrixService.query(null, null);

		// then
		assertThat(result).isEmpty();
	}

}
