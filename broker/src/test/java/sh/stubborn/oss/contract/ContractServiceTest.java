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

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import sh.stubborn.oss.application.ApplicationNotFoundException;
import sh.stubborn.oss.application.ApplicationService;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.then;

@ExtendWith(MockitoExtension.class)
class ContractServiceTest {

	@Mock
	ContractRepository contractRepository;

	@Mock
	ContractTopicRepository contractTopicRepository;

	@Mock
	ApplicationService applicationService;

	@Mock
	ApplicationEventPublisher eventPublisher;

	@Mock
	ContractContentAnalyzer contractContentAnalyzer;

	ContractService contractService;

	UUID applicationId;

	@BeforeEach
	void setUp() {
		this.contractService = new ContractService(this.contractRepository, this.contractTopicRepository,
				this.applicationService, this.eventPublisher, this.contractContentAnalyzer);
		this.applicationId = UUID.randomUUID();
	}

	@Test
	void should_publish_contract_when_application_exists() {
		// given
		given(this.applicationService.findIdByName("order-service")).willReturn(this.applicationId);
		given(this.contractRepository.existsByApplicationIdAndVersionAndContractName(eq(this.applicationId),
				eq("1.0.0"), eq("create-order")))
			.willReturn(false);
		given(this.contractRepository.save(any(Contract.class))).willAnswer(invocation -> invocation.getArgument(0));
		given(this.contractContentAnalyzer.analyze(any(), any())).willReturn(ContractAnalysis.HTTP_DEFAULT);

		// when
		Contract result = this.contractService.publish("order-service", "1.0.0", "create-order", "request: {}",
				"application/x-spring-cloud-contract+yaml");

		// then
		assertThat(result.getContractName()).isEqualTo("create-order");
		assertThat(result.getVersion()).isEqualTo("1.0.0");
		assertThat(result.getContent()).isEqualTo("request: {}");
		then(this.contractRepository).should().save(any(Contract.class));
	}

	@Test
	void should_throw_when_application_not_found() {
		// given
		given(this.applicationService.findIdByName("unknown")).willThrow(new ApplicationNotFoundException("unknown"));

		// when/then
		assertThatThrownBy(
				() -> this.contractService.publish("unknown", "1.0.0", "test", "content", "application/json"))
			.isInstanceOf(ApplicationNotFoundException.class);
	}

	@Test
	void should_throw_when_contract_already_exists() {
		// given
		given(this.applicationService.findIdByName("order-service")).willReturn(this.applicationId);
		given(this.contractRepository.existsByApplicationIdAndVersionAndContractName(eq(this.applicationId),
				eq("1.0.0"), eq("create-order")))
			.willReturn(true);

		// when/then
		assertThatThrownBy(() -> this.contractService.publish("order-service", "1.0.0", "create-order", "content",
				"application/json"))
			.isInstanceOf(ContractAlreadyExistsException.class);
	}

	@Test
	void should_throw_when_version_is_invalid() {
		// when/then
		assertThatThrownBy(() -> this.contractService.publish("order-service", "bad", "create-order", "content",
				"application/json"))
			.isInstanceOf(IllegalArgumentException.class);
	}

	@Test
	void should_find_contracts_by_application_and_version() {
		// given
		given(this.applicationService.findIdByName("order-service")).willReturn(this.applicationId);
		Contract contract = Contract.create(this.applicationId, "1.0.0", "create-order", "content", "yaml");
		given(this.contractRepository.findByApplicationIdAndVersion(eq(this.applicationId), eq("1.0.0")))
			.willReturn(List.of(contract));

		// when
		List<Contract> result = this.contractService.findByApplicationAndVersion("order-service", "1.0.0");

		// then
		assertThat(result).hasSize(1);
		assertThat(result.get(0).getContractName()).isEqualTo("create-order");
	}

	@Test
	void should_find_contract_by_name() {
		// given
		given(this.applicationService.findIdByName("order-service")).willReturn(this.applicationId);
		Contract contract = Contract.create(this.applicationId, "1.0.0", "create-order", "content", "yaml");
		given(this.contractRepository.findByApplicationIdAndVersionAndContractName(eq(this.applicationId), eq("1.0.0"),
				eq("create-order")))
			.willReturn(Optional.of(contract));

		// when
		Contract result = this.contractService.findByApplicationAndVersionAndName("order-service", "1.0.0",
				"create-order");

		// then
		assertThat(result.getContractName()).isEqualTo("create-order");
	}

	@Test
	void should_throw_when_contract_not_found() {
		// given
		given(this.applicationService.findIdByName("order-service")).willReturn(this.applicationId);
		given(this.contractRepository.findByApplicationIdAndVersionAndContractName(eq(this.applicationId), eq("1.0.0"),
				eq("missing")))
			.willReturn(Optional.empty());

		// when/then
		assertThatThrownBy(
				() -> this.contractService.findByApplicationAndVersionAndName("order-service", "1.0.0", "missing"))
			.isInstanceOf(ContractNotFoundException.class);
	}

	@Test
	void should_publish_contract_with_branch() {
		// given
		given(this.applicationService.findIdByName("order-service")).willReturn(this.applicationId);
		given(this.contractRepository.existsByApplicationIdAndVersionAndContractName(eq(this.applicationId),
				eq("1.0.0"), eq("create-order")))
			.willReturn(false);
		given(this.contractRepository.save(any(Contract.class))).willAnswer(invocation -> invocation.getArgument(0));
		given(this.contractContentAnalyzer.analyze(any(), any())).willReturn(ContractAnalysis.HTTP_DEFAULT);

		// when
		Contract result = this.contractService.publish("order-service", "1.0.0", "create-order", "request: {}",
				"application/x-spring-cloud-contract+yaml", "feature/payments");

		// then
		assertThat(result.getBranch()).isEqualTo("feature/payments");
		assertThat(result.getContentHash()).isNotNull();
		then(this.contractRepository).should().save(any(Contract.class));
	}

	@Test
	void should_throw_when_branch_name_is_invalid() {
		// when/then
		assertThatThrownBy(() -> this.contractService.publish("order-service", "1.0.0", "create-order", "content",
				"application/json", " invalid branch "))
			.isInstanceOf(IllegalArgumentException.class);
	}

	@Test
	void should_compute_content_hash_on_publish() {
		// given
		given(this.applicationService.findIdByName("order-service")).willReturn(this.applicationId);
		given(this.contractRepository.existsByApplicationIdAndVersionAndContractName(eq(this.applicationId),
				eq("1.0.0"), eq("create-order")))
			.willReturn(false);
		given(this.contractRepository.save(any(Contract.class))).willAnswer(invocation -> invocation.getArgument(0));
		given(this.contractContentAnalyzer.analyze(any(), any())).willReturn(ContractAnalysis.HTTP_DEFAULT);

		// when
		Contract result = this.contractService.publish("order-service", "1.0.0", "create-order", "request: {}",
				"application/x-spring-cloud-contract+yaml");

		// then
		assertThat(result.getContentHash()).isNotBlank();
		assertThat(result.getContentHash()).hasSize(64);
	}

	@Test
	void should_produce_deterministic_content_hash() {
		// when
		String hash1 = ContractService.computeContentHash("request: {}");
		String hash2 = ContractService.computeContentHash("request: {}");

		// then
		assertThat(hash1).isEqualTo(hash2);
	}

	@Test
	void should_produce_different_hash_for_different_content() {
		// when
		String hash1 = ContractService.computeContentHash("request: {}");
		String hash2 = ContractService.computeContentHash("response: {}");

		// then
		assertThat(hash1).isNotEqualTo(hash2);
	}

	@Test
	void should_find_contracts_by_branch() {
		// given
		given(this.applicationService.findIdByName("order-service")).willReturn(this.applicationId);
		Contract contract = Contract.create(this.applicationId, "1.0.0", "create-order", "content", "yaml",
				"feature/payments", null);
		given(this.contractRepository.findByApplicationIdAndBranch(eq(this.applicationId), eq("feature/payments")))
			.willReturn(List.of(contract));

		// when
		List<Contract> result = this.contractService.findByApplicationAndBranch("order-service", "feature/payments");

		// then
		assertThat(result).hasSize(1);
		assertThat(result.get(0).getBranch()).isEqualTo("feature/payments");
	}

	@Test
	void should_find_contracts_by_content_hash() {
		// given
		given(this.applicationService.findIdByName("order-service")).willReturn(this.applicationId);
		String hash = ContractService.computeContentHash("request: {}");
		Contract contract = Contract.create(this.applicationId, "1.0.0", "create-order", "request: {}", "yaml", null,
				hash);
		given(this.contractRepository.findByApplicationIdAndContentHash(eq(this.applicationId), eq(hash)))
			.willReturn(List.of(contract));

		// when
		List<Contract> result = this.contractService.findByContentHash("order-service", hash);

		// then
		assertThat(result).hasSize(1);
		assertThat(result.get(0).getContentHash()).isEqualTo(hash);
	}

	@Test
	void should_find_contracts_by_application_and_version_paginated() {
		// given
		given(this.applicationService.findIdByName("order-service")).willReturn(this.applicationId);
		Contract contract = Contract.create(this.applicationId, "1.0.0", "create-order", "content", "yaml");
		Page<Contract> page = new PageImpl<>(List.of(contract));
		given(this.contractRepository.findByApplicationIdAndVersion(eq(this.applicationId), eq("1.0.0"),
				any(PageRequest.class)))
			.willReturn(page);

		// when
		Page<Contract> result = this.contractService.findByApplicationAndVersion("order-service", "1.0.0",
				PageRequest.of(0, 10));

		// then
		assertThat(result.getContent()).hasSize(1);
	}

	@Test
	void should_count_contracts() {
		// given
		given(this.contractRepository.count()).willReturn(3L);

		// when
		long count = this.contractService.count();

		// then
		assertThat(count).isEqualTo(3);
	}

	@Test
	void should_find_versions_by_application_name() {
		// given
		given(this.applicationService.findIdByName("order-service")).willReturn(this.applicationId);
		given(this.contractRepository.findDistinctVersionsByApplicationId(this.applicationId))
			.willReturn(List.of("1.0.0", "1.1.0", "2.0.0"));

		// when
		List<String> versions = this.contractService.findVersionsByApplicationName("order-service");

		// then
		assertThat(versions).containsExactly("1.0.0", "1.1.0", "2.0.0");
	}

	@Test
	void should_return_empty_versions_when_no_contracts() {
		// given
		given(this.applicationService.findIdByName("order-service")).willReturn(this.applicationId);
		given(this.contractRepository.findDistinctVersionsByApplicationId(this.applicationId)).willReturn(List.of());

		// when
		List<String> versions = this.contractService.findVersionsByApplicationName("order-service");

		// then
		assertThat(versions).isEmpty();
	}

	@Test
	void should_delete_contract() {
		// given
		given(this.applicationService.findIdByName("order-service")).willReturn(this.applicationId);
		Contract contract = Contract.create(this.applicationId, "1.0.0", "create-order", "content", "yaml");
		given(this.contractRepository.findByApplicationIdAndVersionAndContractName(eq(this.applicationId), eq("1.0.0"),
				eq("create-order")))
			.willReturn(Optional.of(contract));

		// when
		this.contractService.delete("order-service", "1.0.0", "create-order");

		// then
		then(this.contractRepository).should().delete(contract);
	}

	/**
	 * Simulates the race condition: existsBy...() returns false (check passes) but save()
	 * hits a unique constraint violation. The service should catch the
	 * DataIntegrityViolationException and throw ContractAlreadyExistsException (409).
	 * @see <a href="../../../../../docs/specs/039-data-integrity.md">Spec 039 — Data
	 * Integrity</a>
	 */
	@Test
	void should_throw_conflict_when_save_hits_unique_constraint_violation() {
		// given — existsBy returns false (race: another thread inserted between check
		// and save)
		given(this.applicationService.findIdByName("order-service")).willReturn(this.applicationId);
		given(this.contractRepository.existsByApplicationIdAndVersionAndContractName(eq(this.applicationId),
				eq("1.0.0"), eq("create-order")))
			.willReturn(false);
		given(this.contractRepository.save(any(Contract.class)))
			.willThrow(new DataIntegrityViolationException("unique constraint violation"));
		given(this.contractContentAnalyzer.analyze(any(), any())).willReturn(ContractAnalysis.HTTP_DEFAULT);

		// when/then — should get 409 ContractAlreadyExistsException, not 500
		assertThatThrownBy(() -> this.contractService.publish("order-service", "1.0.0", "create-order", "content",
				"application/json"))
			.isInstanceOf(ContractAlreadyExistsException.class)
			.hasMessageContaining("order-service")
			.hasMessageContaining("1.0.0")
			.hasMessageContaining("create-order");
	}

}
