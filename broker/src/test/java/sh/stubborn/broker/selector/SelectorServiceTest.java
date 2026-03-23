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
package sh.stubborn.broker.selector;

import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import sh.stubborn.broker.application.ApplicationInfo;
import sh.stubborn.broker.application.ApplicationService;
import sh.stubborn.broker.contract.ContractInfo;
import sh.stubborn.broker.contract.ContractService;
import sh.stubborn.broker.environment.DeploymentInfo;
import sh.stubborn.broker.environment.DeploymentService;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.BDDMockito.given;

@ExtendWith(MockitoExtension.class)
class SelectorServiceTest {

	@Mock
	ContractService contractService;

	@Mock
	ApplicationService applicationService;

	@Mock
	DeploymentService deploymentService;

	SelectorService selectorService;

	private final UUID appId = UUID.randomUUID();

	@BeforeEach
	void setUp() {
		this.selectorService = new SelectorService(this.contractService, this.applicationService,
				this.deploymentService);
	}

	@Test
	void should_resolve_main_branch_selector() {
		// given
		given(this.applicationService.findAllInfo())
			.willReturn(List.of(new ApplicationInfo(this.appId, "order-service", "team-commerce")));
		given(this.applicationService.findMainBranchByName("order-service")).willReturn("main");
		given(this.contractService.findInfoByApplicationAndBranch("order-service", "main"))
			.willReturn(List.of(new ContractInfo("1.0.0", "get-orders", "main", "abc123")));

		// when
		List<ResolvedContract> result = this.selectorService
			.resolve(List.of(new ConsumerVersionSelector(true, null, null, false, null)));

		// then
		assertThat(result).hasSize(1);
		assertThat(result.get(0).consumerName()).isEqualTo("order-service");
		assertThat(result.get(0).version()).isEqualTo("1.0.0");
		assertThat(result.get(0).branch()).isEqualTo("main");
		assertThat(result.get(0).contractName()).isEqualTo("get-orders");
	}

	@Test
	void should_resolve_branch_with_consumer_selector() {
		// given
		given(this.contractService.findInfoByApplicationAndBranch("payment-service", "feat/refund"))
			.willReturn(List.of(new ContractInfo("2.0.0", "process-refund", "feat/refund", "def456")));

		// when
		List<ResolvedContract> result = this.selectorService
			.resolve(List.of(new ConsumerVersionSelector(false, "feat/refund", "payment-service", false, null)));

		// then
		assertThat(result).hasSize(1);
		assertThat(result.get(0).consumerName()).isEqualTo("payment-service");
		assertThat(result.get(0).branch()).isEqualTo("feat/refund");
	}

	@Test
	void should_resolve_branch_without_consumer() {
		// given
		given(this.applicationService.findAllInfo())
			.willReturn(List.of(new ApplicationInfo(this.appId, "order-service", "team-commerce")));
		given(this.contractService.findInfoByApplicationAndBranch("order-service", "develop"))
			.willReturn(List.of(new ContractInfo("3.0.0", "list-orders", "develop", "ghi789")));

		// when
		List<ResolvedContract> result = this.selectorService
			.resolve(List.of(new ConsumerVersionSelector(false, "develop", null, false, null)));

		// then
		assertThat(result).hasSize(1);
		assertThat(result.get(0).consumerName()).isEqualTo("order-service");
	}

	@Test
	void should_resolve_deployed_selector() {
		// given
		given(this.deploymentService.findDeploymentInfoByEnvironment("production"))
			.willReturn(List.of(new DeploymentInfo(this.appId, "1.5.0")));
		given(this.applicationService.findNameById(this.appId)).willReturn("order-service");
		given(this.contractService.findInfoByApplicationAndVersion("order-service", "1.5.0"))
			.willReturn(List.of(new ContractInfo("1.5.0", "get-order", "main", "jkl012")));

		// when
		List<ResolvedContract> result = this.selectorService
			.resolve(List.of(new ConsumerVersionSelector(false, null, null, true, "production")));

		// then
		assertThat(result).hasSize(1);
		assertThat(result.get(0).consumerName()).isEqualTo("order-service");
		assertThat(result.get(0).version()).isEqualTo("1.5.0");
	}

	@Test
	void should_resolve_consumer_selector() {
		// given
		given(this.applicationService.findMainBranchByName("payment-service")).willReturn("main");
		given(this.contractService.findInfoByApplicationAndBranch("payment-service", "main"))
			.willReturn(List.of(new ContractInfo("1.0.0", "pay", "main", "mno345")));

		// when
		List<ResolvedContract> result = this.selectorService
			.resolve(List.of(new ConsumerVersionSelector(false, null, "payment-service", false, null)));

		// then
		assertThat(result).hasSize(1);
		assertThat(result.get(0).consumerName()).isEqualTo("payment-service");
	}

	@Test
	void should_deduplicate_results_across_selectors() {
		// given
		given(this.applicationService.findMainBranchByName("order-service")).willReturn("main");
		given(this.contractService.findInfoByApplicationAndBranch("order-service", "main"))
			.willReturn(List.of(new ContractInfo("1.0.0", "get-orders", "main", "abc123")));

		// when — two selectors that both resolve the same contract
		List<ResolvedContract> result = this.selectorService
			.resolve(List.of(new ConsumerVersionSelector(false, "main", "order-service", false, null),
					new ConsumerVersionSelector(false, null, "order-service", false, null)));

		// then — deduplicated to one result
		assertThat(result).hasSize(1);
	}

	@Test
	void should_return_empty_when_no_selectors_match() {
		// when
		List<ResolvedContract> result = this.selectorService
			.resolve(List.of(new ConsumerVersionSelector(false, null, null, false, null)));

		// then
		assertThat(result).isEmpty();
	}

	@Test
	void should_resolve_main_branch_when_deployed_is_null() {
		// given — simulates UI sending {"mainBranch": true} without "deployed" field
		given(this.applicationService.findAllInfo())
			.willReturn(List.of(new ApplicationInfo(this.appId, "order-service", "team-commerce")));
		given(this.applicationService.findMainBranchByName("order-service")).willReturn("main");
		given(this.contractService.findInfoByApplicationAndBranch("order-service", "main"))
			.willReturn(List.of(new ContractInfo("1.0.0", "get-orders", "main", "abc123")));

		// when
		List<ResolvedContract> result = this.selectorService
			.resolve(List.of(new ConsumerVersionSelector(true, null, null, null, null)));

		// then
		assertThat(result).hasSize(1);
		assertThat(result.get(0).consumerName()).isEqualTo("order-service");
	}

	@Test
	void should_return_empty_when_all_selector_fields_are_null() {
		// when — all fields null (edge case)
		List<ResolvedContract> result = this.selectorService
			.resolve(List.of(new ConsumerVersionSelector(null, null, null, null, null)));

		// then
		assertThat(result).isEmpty();
	}

}
