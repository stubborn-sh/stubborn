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
package org.springframework.cloud.contract.broker.contract;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.cloud.contract.broker.TestcontainersConfiguration;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;

import static org.assertj.core.api.Assertions.assertThat;

@DataJpaTest
@Import(TestcontainersConfiguration.class)
class ContractRepositoryTest {

	@Autowired
	ContractRepository contractRepository;

	@Autowired
	JdbcTemplate jdbcTemplate;

	UUID applicationId;

	@BeforeEach
	void setUp() {
		this.applicationId = UUID.randomUUID();
		this.jdbcTemplate.update(
				"INSERT INTO applications (id, name, description, owner, created_at, updated_at, version) VALUES (?, ?, ?, ?, NOW(), NOW(), 0)",
				this.applicationId, "repo-test-app-" + this.applicationId.toString().substring(0, 8), "desc", "owner");
	}

	@Test
	void should_save_and_find_contract_by_application_and_version() {
		// given
		Contract contract = Contract.create(this.applicationId, "1.0.0", "create-order", "request: {}", "yaml");
		this.contractRepository.save(contract);

		// when
		List<Contract> result = this.contractRepository.findByApplicationIdAndVersion(this.applicationId, "1.0.0");

		// then
		assertThat(result).hasSize(1);
		assertThat(result.get(0).getContractName()).isEqualTo("create-order");
	}

	@Test
	void should_find_contract_by_application_version_and_name() {
		// given
		Contract contract = Contract.create(this.applicationId, "1.0.0", "create-order", "request: {}", "yaml");
		this.contractRepository.save(contract);

		// when
		Optional<Contract> result = this.contractRepository
			.findByApplicationIdAndVersionAndContractName(this.applicationId, "1.0.0", "create-order");

		// then
		assertThat(result).isPresent();
		assertThat(result.get().getContent()).isEqualTo("request: {}");
	}

	@Test
	void should_return_empty_when_contract_not_found() {
		// when
		Optional<Contract> result = this.contractRepository
			.findByApplicationIdAndVersionAndContractName(this.applicationId, "1.0.0", "nonexistent");

		// then
		assertThat(result).isEmpty();
	}

	@Test
	void should_check_existence_by_application_version_and_name() {
		// given
		Contract contract = Contract.create(this.applicationId, "1.0.0", "create-order", "request: {}", "yaml");
		this.contractRepository.save(contract);

		// when/then
		assertThat(this.contractRepository.existsByApplicationIdAndVersionAndContractName(this.applicationId, "1.0.0",
				"create-order"))
			.isTrue();
		assertThat(this.contractRepository.existsByApplicationIdAndVersionAndContractName(this.applicationId, "1.0.0",
				"nonexistent"))
			.isFalse();
	}

	@Test
	void should_find_multiple_contracts_for_same_version() {
		// given
		this.contractRepository
			.save(Contract.create(this.applicationId, "1.0.0", "create-order", "create content", "yaml"));
		this.contractRepository.save(Contract.create(this.applicationId, "1.0.0", "get-order", "get content", "yaml"));
		this.contractRepository
			.save(Contract.create(this.applicationId, "2.0.0", "create-order-v2", "v2 content", "yaml"));

		// when
		List<Contract> v1Contracts = this.contractRepository.findByApplicationIdAndVersion(this.applicationId, "1.0.0");
		List<Contract> v2Contracts = this.contractRepository.findByApplicationIdAndVersion(this.applicationId, "2.0.0");

		// then
		assertThat(v1Contracts).hasSize(2);
		assertThat(v2Contracts).hasSize(1);
	}

}
