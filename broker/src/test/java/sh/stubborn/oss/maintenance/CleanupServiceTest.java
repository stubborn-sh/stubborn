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
package sh.stubborn.oss.maintenance;

import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import sh.stubborn.oss.application.ApplicationInfo;
import sh.stubborn.oss.application.ApplicationService;
import sh.stubborn.oss.contract.ContractInfo;
import sh.stubborn.oss.contract.ContractService;
import sh.stubborn.oss.environment.DeploymentInfo;
import sh.stubborn.oss.environment.DeploymentService;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.then;

@ExtendWith(MockitoExtension.class)
class CleanupServiceTest {

	@Mock
	ContractService contractService;

	@Mock
	ApplicationService applicationService;

	@Mock
	DeploymentService deploymentService;

	CleanupService cleanupService;

	private final UUID appId = UUID.randomUUID();

	@BeforeEach
	void setUp() {
		this.cleanupService = new CleanupService(this.contractService, this.applicationService, this.deploymentService);
	}

	@Test
	void should_delete_old_versions_keeping_latest() {
		// given
		given(this.applicationService.findIdByName("order-service")).willReturn(this.appId);
		given(this.applicationService.findOwnerById(this.appId)).willReturn("team-commerce");
		given(this.applicationService.findMainBranchByName("order-service")).willReturn("main");
		given(this.contractService.findInfoByApplicationAndBranch("order-service", "main"))
			.willReturn(List.of(new ContractInfo("3.0.0", "get-orders", "main", "hash3", "HTTP"),
					new ContractInfo("2.0.0", "get-orders", "main", "hash2", "HTTP"),
					new ContractInfo("1.0.0", "get-orders", "main", "hash1", "HTTP")));

		// when — keep 2 latest, no protected environments
		CleanupResult result = this.cleanupService.cleanup("order-service", 2, List.of());

		// then — version 1.0.0 should be deleted
		assertThat(result.deletedCount()).isEqualTo(1);
		then(this.contractService).should().delete("order-service", "1.0.0", "get-orders");
	}

	@Test
	void should_not_delete_deployed_versions() {
		// given
		given(this.applicationService.findIdByName("order-service")).willReturn(this.appId);
		given(this.applicationService.findOwnerById(this.appId)).willReturn("team-commerce");
		given(this.applicationService.findMainBranchByName("order-service")).willReturn("main");
		given(this.applicationService.findNameById(this.appId)).willReturn("order-service");
		given(this.contractService.findInfoByApplicationAndBranch("order-service", "main"))
			.willReturn(List.of(new ContractInfo("2.0.0", "get-orders", "main", "hash2", "HTTP"),
					new ContractInfo("1.0.0", "get-orders", "main", "hash1", "HTTP")));
		given(this.deploymentService.findDeploymentInfoByEnvironment("prod"))
			.willReturn(List.of(new DeploymentInfo(this.appId, "1.0.0")));

		// when — keep 1 latest, but 1.0.0 is deployed to prod
		CleanupResult result = this.cleanupService.cleanup("order-service", 1, List.of("prod"));

		// then — nothing deleted because 1.0.0 is protected by deployment
		assertThat(result.deletedCount()).isEqualTo(0);
	}

	@Test
	void should_cleanup_all_applications_when_name_is_null() {
		// given
		given(this.applicationService.findAllInfo())
			.willReturn(List.of(new ApplicationInfo(this.appId, "order-service", "team-commerce")));
		given(this.applicationService.findMainBranchByName("order-service")).willReturn("main");
		given(this.contractService.findInfoByApplicationAndBranch("order-service", "main"))
			.willReturn(List.of(new ContractInfo("2.0.0", "get-orders", "main", "hash2", "HTTP"),
					new ContractInfo("1.0.0", "get-orders", "main", "hash1", "HTTP")));

		// when
		CleanupResult result = this.cleanupService.cleanup(null, 1, List.of());

		// then
		assertThat(result.deletedCount()).isEqualTo(1);
	}

	@Test
	void should_return_zero_when_nothing_to_delete() {
		// given
		given(this.applicationService.findIdByName("order-service")).willReturn(this.appId);
		given(this.applicationService.findOwnerById(this.appId)).willReturn("team-commerce");
		given(this.applicationService.findMainBranchByName("order-service")).willReturn("main");
		given(this.contractService.findInfoByApplicationAndBranch("order-service", "main"))
			.willReturn(List.of(new ContractInfo("1.0.0", "get-orders", "main", "hash1", "HTTP")));

		// when — keep 5 latest, only 1 exists
		CleanupResult result = this.cleanupService.cleanup("order-service", 5, List.of());

		// then
		assertThat(result.deletedCount()).isEqualTo(0);
		assertThat(result.deletedContracts()).isEmpty();
	}

}
