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
package org.springframework.cloud.contract.broker.verification;

import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.cloud.contract.broker.TestcontainersConfiguration;
import org.springframework.context.annotation.Import;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.jdbc.core.JdbcTemplate;

import static org.assertj.core.api.Assertions.assertThat;

@DataJpaTest
@Import(TestcontainersConfiguration.class)
class VerificationRepositoryTest {

	@Autowired
	VerificationRepository repository;

	@Autowired
	JdbcTemplate jdbcTemplate;

	UUID providerId;

	UUID consumerId;

	@BeforeEach
	void setUp() {
		this.providerId = UUID.randomUUID();
		this.consumerId = UUID.randomUUID();
		this.jdbcTemplate.update(
				"INSERT INTO applications (id, name, description, owner, created_at, updated_at, version) VALUES (?, ?, ?, ?, NOW(), NOW(), 0)",
				this.providerId, "provider-" + this.providerId.toString().substring(0, 8), "desc", "owner");
		this.jdbcTemplate.update(
				"INSERT INTO applications (id, name, description, owner, created_at, updated_at, version) VALUES (?, ?, ?, ?, NOW(), NOW(), 0)",
				this.consumerId, "consumer-" + this.consumerId.toString().substring(0, 8), "desc", "owner");
	}

	@Test
	void should_save_and_find_by_provider_and_version() {
		// given
		Verification verification = Verification.create(this.providerId, "1.0.0", this.consumerId, "2.0.0",
				VerificationStatus.SUCCESS, null);
		this.repository.save(verification);

		// when
		List<Verification> result = this.repository.findByProviderIdAndProviderVersion(this.providerId, "1.0.0");

		// then
		assertThat(result).hasSize(1);
		assertThat(result.get(0).getProviderId()).isEqualTo(this.providerId);
		assertThat(result.get(0).getConsumerId()).isEqualTo(this.consumerId);
		assertThat(result.get(0).getStatus()).isEqualTo(VerificationStatus.SUCCESS);
		assertThat(result.get(0).getVerifiedAt()).isNotNull();
	}

	@Test
	void should_find_by_provider_and_version_paginated() {
		// given
		this.repository.save(Verification.create(this.providerId, "1.0.0", this.consumerId, "2.0.0",
				VerificationStatus.SUCCESS, null));
		this.repository.save(Verification.create(this.providerId, "1.0.0", this.consumerId, "3.0.0",
				VerificationStatus.FAILED, "Contract mismatch"));

		// when
		Page<Verification> page = this.repository.findByProviderIdAndProviderVersion(this.providerId, "1.0.0",
				PageRequest.of(0, 10));

		// then
		assertThat(page.getTotalElements()).isEqualTo(2);
		assertThat(page.getContent()).hasSize(2);
	}

	@Test
	void should_check_existence_by_provider_consumer_and_version() {
		// given
		this.repository.save(Verification.create(this.providerId, "1.0.0", this.consumerId, "2.0.0",
				VerificationStatus.SUCCESS, null));

		// when/then
		assertThat(this.repository.existsByProviderIdAndProviderVersionAndConsumerIdAndConsumerVersion(this.providerId,
				"1.0.0", this.consumerId, "2.0.0"))
			.isTrue();
		assertThat(this.repository.existsByProviderIdAndProviderVersionAndConsumerIdAndConsumerVersion(this.providerId,
				"1.0.0", this.consumerId, "9.9.9"))
			.isFalse();
	}

	@Test
	void should_check_existence_with_status() {
		// given
		this.repository.save(Verification.create(this.providerId, "1.0.0", this.consumerId, "2.0.0",
				VerificationStatus.FAILED, "error"));

		// when/then
		assertThat(this.repository.existsByProviderIdAndProviderVersionAndConsumerIdAndConsumerVersionAndStatus(
				this.providerId, "1.0.0", this.consumerId, "2.0.0", VerificationStatus.FAILED))
			.isTrue();
		assertThat(this.repository.existsByProviderIdAndProviderVersionAndConsumerIdAndConsumerVersionAndStatus(
				this.providerId, "1.0.0", this.consumerId, "2.0.0", VerificationStatus.SUCCESS))
			.isFalse();
	}

	@Test
	void should_find_by_provider_id() {
		// given
		this.repository.save(Verification.create(this.providerId, "1.0.0", this.consumerId, "2.0.0",
				VerificationStatus.SUCCESS, null));
		this.repository.save(Verification.create(this.providerId, "2.0.0", this.consumerId, "3.0.0",
				VerificationStatus.SUCCESS, null));

		// when
		List<Verification> result = this.repository.findByProviderId(this.providerId);

		// then
		assertThat(result).hasSize(2);
	}

	@Test
	void should_find_by_consumer_id() {
		// given
		this.repository.save(Verification.create(this.providerId, "1.0.0", this.consumerId, "2.0.0",
				VerificationStatus.SUCCESS, null));

		// when
		List<Verification> result = this.repository.findByConsumerId(this.consumerId);

		// then
		assertThat(result).hasSize(1);
		assertThat(result.get(0).getConsumerId()).isEqualTo(this.consumerId);
	}

	@Test
	void should_return_empty_when_no_matching_verifications() {
		// when
		List<Verification> result = this.repository.findByProviderIdAndProviderVersion(this.providerId, "99.0.0");

		// then
		assertThat(result).isEmpty();
	}

	@Test
	void should_store_details_for_failed_verification() {
		// given
		Verification verification = Verification.create(this.providerId, "1.0.0", this.consumerId, "2.0.0",
				VerificationStatus.FAILED, "Missing field: orderId");
		this.repository.save(verification);

		// when
		List<Verification> result = this.repository.findByProviderIdAndProviderVersion(this.providerId, "1.0.0");

		// then
		assertThat(result).hasSize(1);
		assertThat(result.get(0).getDetails()).isEqualTo("Missing field: orderId");
	}

}
