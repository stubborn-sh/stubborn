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
package org.springframework.cloud.contract.broker.safety;

import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import org.springframework.cloud.contract.broker.application.ApplicationNotFoundException;
import org.springframework.cloud.contract.broker.application.ApplicationService;
import org.springframework.cloud.contract.broker.environment.DeploymentInfo;
import org.springframework.cloud.contract.broker.environment.DeploymentService;
import org.springframework.cloud.contract.broker.verification.VerificationService;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.BDDMockito.given;

@ExtendWith(MockitoExtension.class)
class CanIDeployServiceTest {

	@Mock
	ApplicationService applicationService;

	@Mock
	DeploymentService deploymentService;

	@Mock
	VerificationService verificationService;

	CanIDeployService canIDeployService;

	UUID providerId;

	UUID consumerId;

	@BeforeEach
	void setUp() {
		DeploymentSafetyChecker safetyChecker = new OssDeploymentSafetyChecker(this.applicationService,
				this.deploymentService, this.verificationService);
		this.canIDeployService = new CanIDeployService(this.applicationService, safetyChecker);
		this.providerId = UUID.randomUUID();
		this.consumerId = UUID.randomUUID();
	}

	@Test
	void should_return_safe_when_no_consumers_deployed() {
		// given
		given(this.applicationService.findIdByName("order-service")).willReturn(this.providerId);
		given(this.deploymentService.findDeploymentInfoByEnvironment("staging")).willReturn(List.of());

		// when
		CanIDeployResponse result = this.canIDeployService.check("order-service", "1.0.0", "staging");

		// then
		assertThat(result.safe()).isTrue();
		assertThat(result.summary()).isEqualTo("No consumers deployed to this environment");
		assertThat(result.consumerResults()).isEmpty();
	}

	@Test
	void should_return_safe_when_all_consumers_verified() {
		// given
		given(this.applicationService.findIdByName("order-service")).willReturn(this.providerId);
		given(this.deploymentService.findDeploymentInfoByEnvironment("staging"))
			.willReturn(List.of(new DeploymentInfo(this.consumerId, "2.0.0")));
		given(this.applicationService.findNameById(this.consumerId)).willReturn("payment-service");
		given(this.verificationService.hasSuccessfulVerification(this.providerId, "1.0.0", this.consumerId, "2.0.0"))
			.willReturn(true);

		// when
		CanIDeployResponse result = this.canIDeployService.check("order-service", "1.0.0", "staging");

		// then
		assertThat(result.safe()).isTrue();
		assertThat(result.summary()).isEqualTo("All 1 consumer(s) verified successfully");
		assertThat(result.consumerResults()).hasSize(1);
		assertThat(result.consumerResults().get(0).verified()).isTrue();
	}

	@Test
	void should_return_unsafe_when_consumer_not_verified() {
		// given
		given(this.applicationService.findIdByName("order-service")).willReturn(this.providerId);
		given(this.deploymentService.findDeploymentInfoByEnvironment("staging"))
			.willReturn(List.of(new DeploymentInfo(this.consumerId, "2.0.0")));
		given(this.applicationService.findNameById(this.consumerId)).willReturn("payment-service");
		given(this.verificationService.hasSuccessfulVerification(this.providerId, "1.0.0", this.consumerId, "2.0.0"))
			.willReturn(false);

		// when
		CanIDeployResponse result = this.canIDeployService.check("order-service", "1.0.0", "staging");

		// then
		assertThat(result.safe()).isFalse();
		assertThat(result.summary()).isEqualTo("1 of 1 consumer(s) missing successful verification");
		assertThat(result.consumerResults().get(0).verified()).isFalse();
	}

	@Test
	void should_exclude_provider_from_consumer_list() {
		// given — provider itself is deployed to the same environment
		given(this.applicationService.findIdByName("order-service")).willReturn(this.providerId);
		given(this.deploymentService.findDeploymentInfoByEnvironment("staging"))
			.willReturn(List.of(new DeploymentInfo(this.providerId, "1.0.0")));

		// when
		CanIDeployResponse result = this.canIDeployService.check("order-service", "1.0.0", "staging");

		// then — provider excluded, no consumers, safe
		assertThat(result.safe()).isTrue();
		assertThat(result.consumerResults()).isEmpty();
	}

	@Test
	void should_throw_when_application_not_found() {
		// given
		given(this.applicationService.findIdByName("unknown")).willThrow(new ApplicationNotFoundException("unknown"));

		// when/then
		assertThatThrownBy(() -> this.canIDeployService.check("unknown", "1.0.0", "staging"))
			.isInstanceOf(ApplicationNotFoundException.class);
	}

	@Test
	void should_throw_when_version_invalid() {
		// when/then
		assertThatThrownBy(() -> this.canIDeployService.check("order-service", "bad", "staging"))
			.isInstanceOf(IllegalArgumentException.class);
	}

	@Test
	void should_return_mixed_results_for_multiple_consumers() {
		// given
		UUID consumer2Id = UUID.randomUUID();
		given(this.applicationService.findIdByName("order-service")).willReturn(this.providerId);
		given(this.deploymentService.findDeploymentInfoByEnvironment("staging")).willReturn(
				List.of(new DeploymentInfo(this.consumerId, "2.0.0"), new DeploymentInfo(consumer2Id, "3.0.0")));
		given(this.applicationService.findNameById(this.consumerId)).willReturn("payment-service");
		given(this.applicationService.findNameById(consumer2Id)).willReturn("shipping-service");
		given(this.verificationService.hasSuccessfulVerification(this.providerId, "1.0.0", this.consumerId, "2.0.0"))
			.willReturn(true);
		given(this.verificationService.hasSuccessfulVerification(this.providerId, "1.0.0", consumer2Id, "3.0.0"))
			.willReturn(false);

		// when
		CanIDeployResponse result = this.canIDeployService.check("order-service", "1.0.0", "staging");

		// then
		assertThat(result.safe()).isFalse();
		assertThat(result.consumerResults()).hasSize(2);
		assertThat(result.summary()).contains("1 of 2");
	}

}
