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
package sh.stubborn.oss.safety;

import java.util.List;
import java.util.Set;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import sh.stubborn.oss.application.ApplicationNotFoundException;
import sh.stubborn.oss.application.ApplicationService;
import sh.stubborn.oss.dependency.DependencyService;
import sh.stubborn.oss.environment.DeploymentInfo;
import sh.stubborn.oss.environment.DeploymentService;
import sh.stubborn.oss.verification.VerificationService;

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

	@Mock
	DependencyService dependencyService;

	CanIDeployService canIDeployService;

	UUID providerId;

	UUID consumerId;

	@BeforeEach
	void setUp() {
		DeploymentSafetyChecker safetyChecker = new OssDeploymentSafetyChecker(this.applicationService,
				this.deploymentService, this.verificationService, this.dependencyService);
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
		assertThat(result.summary())
			.isEqualTo("No consumers or providers of this application deployed to this environment");
		assertThat(result.consumerResults()).isEmpty();
	}

	@Test
	void should_return_safe_when_all_consumers_verified() {
		// given
		given(this.applicationService.findIdByName("order-service")).willReturn(this.providerId);
		given(this.deploymentService.findDeploymentInfoByEnvironment("staging"))
			.willReturn(List.of(new DeploymentInfo(this.consumerId, "2.0.0")));
		given(this.verificationService.findConsumerIdsByProviderId(this.providerId))
			.willReturn(Set.of(this.consumerId));
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
		given(this.verificationService.findConsumerIdsByProviderId(this.providerId))
			.willReturn(Set.of(this.consumerId));
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
		given(this.verificationService.findConsumerIdsByProviderId(this.providerId))
			.willReturn(Set.of(this.consumerId, consumer2Id));
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

	@Test
	void should_ignore_applications_that_were_never_consumers_of_the_provider() {
		// given — an unrelated app is deployed to the same environment but has never
		// verified against, nor published a contract against, the provider
		UUID unrelatedId = UUID.randomUUID();
		given(this.applicationService.findIdByName("provider-a")).willReturn(this.providerId);
		given(this.deploymentService.findDeploymentInfoByEnvironment("staging")).willReturn(
				List.of(new DeploymentInfo(this.consumerId, "2.0.0"), new DeploymentInfo(unrelatedId, "9.9.9")));
		given(this.verificationService.findConsumerIdsByProviderId(this.providerId))
			.willReturn(Set.of(this.consumerId));
		given(this.applicationService.findNameById(this.consumerId)).willReturn("real-consumer");
		given(this.verificationService.hasSuccessfulVerification(this.providerId, "1.0.0", this.consumerId, "2.0.0"))
			.willReturn(true);

		// when
		CanIDeployResponse result = this.canIDeployService.check("provider-a", "1.0.0", "staging");

		// then — only the real consumer is evaluated
		assertThat(result.consumerResults()).extracting(ConsumerResult::consumer).containsExactly("real-consumer");
		assertThat(result.safe()).isTrue();
	}

	@Test
	void should_evaluate_known_consumer_deployed_at_an_unverified_version() {
		// given — a historical relationship exists, but the deployed version was never
		// verified against this provider version
		given(this.applicationService.findIdByName("provider-a")).willReturn(this.providerId);
		given(this.deploymentService.findDeploymentInfoByEnvironment("staging"))
			.willReturn(List.of(new DeploymentInfo(this.consumerId, "3.0.0")));
		given(this.verificationService.findConsumerIdsByProviderId(this.providerId))
			.willReturn(Set.of(this.consumerId));
		given(this.applicationService.findNameById(this.consumerId)).willReturn("real-consumer");
		given(this.verificationService.hasSuccessfulVerification(this.providerId, "1.0.0", this.consumerId, "3.0.0"))
			.willReturn(false);

		// when
		CanIDeployResponse result = this.canIDeployService.check("provider-a", "1.0.0", "staging");

		// then
		assertThat(result.safe()).isFalse();
		assertThat(result.consumerResults()).hasSize(1);
	}

	@Test
	void should_evaluate_a_consumer_that_declared_a_dependency_but_never_verified() {
		// given — the consumer has declared it depends on the provider but has no
		// verification against it at all, the case verification history alone cannot see
		given(this.applicationService.findIdByName("provider-a")).willReturn(this.providerId);
		given(this.deploymentService.findDeploymentInfoByEnvironment("staging"))
			.willReturn(List.of(new DeploymentInfo(this.consumerId, "2.0.0")));
		given(this.dependencyService.findConsumerIdsByProviderId(this.providerId)).willReturn(Set.of(this.consumerId));
		given(this.verificationService.findConsumerIdsByProviderId(this.providerId)).willReturn(Set.of());
		given(this.applicationService.findNameById(this.consumerId)).willReturn("declared-consumer");
		given(this.verificationService.hasSuccessfulVerification(this.providerId, "1.0.0", this.consumerId, "2.0.0"))
			.willReturn(false);

		// when
		CanIDeployResponse result = this.canIDeployService.check("provider-a", "1.0.0", "staging");

		// then — the declaration alone makes it a known consumer, so it blocks
		assertThat(result.consumerResults()).extracting(ConsumerResult::consumer).containsExactly("declared-consumer");
		assertThat(result.safe()).isFalse();
	}

	@Test
	void should_evaluate_consumers_known_only_by_declaration_and_only_by_verification_together() {
		// given — one consumer known through a declaration, another only through history
		UUID declaredOnlyId = UUID.randomUUID();
		given(this.applicationService.findIdByName("provider-a")).willReturn(this.providerId);
		given(this.deploymentService.findDeploymentInfoByEnvironment("staging")).willReturn(
				List.of(new DeploymentInfo(this.consumerId, "2.0.0"), new DeploymentInfo(declaredOnlyId, "3.0.0")));
		given(this.dependencyService.findConsumerIdsByProviderId(this.providerId)).willReturn(Set.of(declaredOnlyId));
		given(this.verificationService.findConsumerIdsByProviderId(this.providerId))
			.willReturn(Set.of(this.consumerId));
		given(this.applicationService.findNameById(this.consumerId)).willReturn("verified-consumer");
		given(this.applicationService.findNameById(declaredOnlyId)).willReturn("declared-consumer");
		given(this.verificationService.hasSuccessfulVerification(this.providerId, "1.0.0", this.consumerId, "2.0.0"))
			.willReturn(true);
		given(this.verificationService.hasSuccessfulVerification(this.providerId, "1.0.0", declaredOnlyId, "3.0.0"))
			.willReturn(true);

		// when
		CanIDeployResponse result = this.canIDeployService.check("provider-a", "1.0.0", "staging");

		// then — the union covers both
		assertThat(result.consumerResults()).extracting(ConsumerResult::consumer)
			.containsExactlyInAnyOrder("verified-consumer", "declared-consumer");
		assertThat(result.safe()).isTrue();
	}

	@Test
	void should_return_unsafe_when_the_application_never_verified_against_a_deployed_provider() {
		// given — order-service is about to be deployed and depends on payment-service,
		// which already runs 5.0.0 in staging, but never verified against that version
		UUID paymentId = UUID.randomUUID();
		given(this.applicationService.findIdByName("order-service")).willReturn(this.providerId);
		given(this.deploymentService.findDeploymentInfoByEnvironment("staging"))
			.willReturn(List.of(new DeploymentInfo(paymentId, "5.0.0")));
		given(this.dependencyService.findProviderIdsByConsumerId(this.providerId)).willReturn(Set.of(paymentId));
		given(this.applicationService.findNameById(paymentId)).willReturn("payment-service");
		given(this.verificationService.hasSuccessfulVerification(paymentId, "5.0.0", this.providerId, "1.0.0"))
			.willReturn(false);

		// when
		CanIDeployResponse result = this.canIDeployService.check("order-service", "1.0.0", "staging");

		// then — deploying would break order-service against the provider it calls
		assertThat(result.safe()).isFalse();
		assertThat(result.providerResults()).extracting(ProviderResult::provider).containsExactly("payment-service");
		assertThat(result.providerResults().get(0).providerVersion()).isEqualTo("5.0.0");
		assertThat(result.providerResults().get(0).verified()).isFalse();
		assertThat(result.summary()).isEqualTo("1 of 1 provider(s) missing successful verification");
	}

	@Test
	void should_return_safe_when_the_application_verified_against_every_deployed_provider() {
		// given
		UUID paymentId = UUID.randomUUID();
		given(this.applicationService.findIdByName("order-service")).willReturn(this.providerId);
		given(this.deploymentService.findDeploymentInfoByEnvironment("staging"))
			.willReturn(List.of(new DeploymentInfo(paymentId, "5.0.0")));
		given(this.verificationService.findProviderIdsByConsumerId(this.providerId)).willReturn(Set.of(paymentId));
		given(this.applicationService.findNameById(paymentId)).willReturn("payment-service");
		given(this.verificationService.hasSuccessfulVerification(paymentId, "5.0.0", this.providerId, "1.0.0"))
			.willReturn(true);

		// when
		CanIDeployResponse result = this.canIDeployService.check("order-service", "1.0.0", "staging");

		// then
		assertThat(result.safe()).isTrue();
		assertThat(result.summary()).isEqualTo("All 1 provider(s) verified successfully");
	}

	@Test
	void should_ignore_deployed_applications_the_candidate_does_not_consume() {
		// given — an unrelated app runs in staging, the candidate neither declared nor
		// ever verified against it
		UUID unrelatedId = UUID.randomUUID();
		given(this.applicationService.findIdByName("order-service")).willReturn(this.providerId);
		given(this.deploymentService.findDeploymentInfoByEnvironment("staging"))
			.willReturn(List.of(new DeploymentInfo(unrelatedId, "9.9.9")));

		// when
		CanIDeployResponse result = this.canIDeployService.check("order-service", "1.0.0", "staging");

		// then
		assertThat(result.providerResults()).isEmpty();
		assertThat(result.safe()).isTrue();
	}

	@Test
	void should_exclude_the_application_itself_from_the_provider_list() {
		// given — the candidate is already deployed to the environment
		given(this.applicationService.findIdByName("order-service")).willReturn(this.providerId);
		given(this.deploymentService.findDeploymentInfoByEnvironment("staging"))
			.willReturn(List.of(new DeploymentInfo(this.providerId, "0.9.0")));
		given(this.dependencyService.findProviderIdsByConsumerId(this.providerId)).willReturn(Set.of(this.providerId));

		// when
		CanIDeployResponse result = this.canIDeployService.check("order-service", "1.0.0", "staging");

		// then — an application is never its own provider
		assertThat(result.providerResults()).isEmpty();
		assertThat(result.safe()).isTrue();
	}

	@Test
	void should_evaluate_providers_known_only_by_declaration_and_only_by_verification_together() {
		// given — one provider known through a declaration, another only through history
		UUID declaredOnlyId = UUID.randomUUID();
		UUID verifiedOnlyId = UUID.randomUUID();
		given(this.applicationService.findIdByName("order-service")).willReturn(this.providerId);
		given(this.deploymentService.findDeploymentInfoByEnvironment("staging")).willReturn(
				List.of(new DeploymentInfo(declaredOnlyId, "5.0.0"), new DeploymentInfo(verifiedOnlyId, "6.0.0")));
		given(this.dependencyService.findProviderIdsByConsumerId(this.providerId)).willReturn(Set.of(declaredOnlyId));
		given(this.verificationService.findProviderIdsByConsumerId(this.providerId)).willReturn(Set.of(verifiedOnlyId));
		given(this.applicationService.findNameById(declaredOnlyId)).willReturn("declared-provider");
		given(this.applicationService.findNameById(verifiedOnlyId)).willReturn("verified-provider");
		given(this.verificationService.hasSuccessfulVerification(declaredOnlyId, "5.0.0", this.providerId, "1.0.0"))
			.willReturn(true);
		given(this.verificationService.hasSuccessfulVerification(verifiedOnlyId, "6.0.0", this.providerId, "1.0.0"))
			.willReturn(true);

		// when
		CanIDeployResponse result = this.canIDeployService.check("order-service", "1.0.0", "staging");

		// then — the union covers both
		assertThat(result.providerResults()).extracting(ProviderResult::provider)
			.containsExactlyInAnyOrder("declared-provider", "verified-provider");
		assertThat(result.safe()).isTrue();
	}

	@Test
	void should_report_both_directions_when_consumers_and_providers_are_deployed() {
		// given — order-service is called by payment-service and calls stock-service,
		// both already deployed to staging
		UUID stockId = UUID.randomUUID();
		given(this.applicationService.findIdByName("order-service")).willReturn(this.providerId);
		given(this.deploymentService.findDeploymentInfoByEnvironment("staging"))
			.willReturn(List.of(new DeploymentInfo(this.consumerId, "2.0.0"), new DeploymentInfo(stockId, "5.0.0")));
		given(this.verificationService.findConsumerIdsByProviderId(this.providerId))
			.willReturn(Set.of(this.consumerId));
		given(this.verificationService.findProviderIdsByConsumerId(this.providerId)).willReturn(Set.of(stockId));
		given(this.applicationService.findNameById(this.consumerId)).willReturn("payment-service");
		given(this.applicationService.findNameById(stockId)).willReturn("stock-service");
		given(this.verificationService.hasSuccessfulVerification(this.providerId, "1.0.0", this.consumerId, "2.0.0"))
			.willReturn(true);
		given(this.verificationService.hasSuccessfulVerification(stockId, "5.0.0", this.providerId, "1.0.0"))
			.willReturn(true);

		// when
		CanIDeployResponse result = this.canIDeployService.check("order-service", "1.0.0", "staging");

		// then
		assertThat(result.safe()).isTrue();
		assertThat(result.consumerResults()).extracting(ConsumerResult::consumer).containsExactly("payment-service");
		assertThat(result.providerResults()).extracting(ProviderResult::provider).containsExactly("stock-service");
		assertThat(result.summary()).isEqualTo("All 1 consumer(s) and 1 provider(s) verified successfully");
	}

	@Test
	void should_report_failures_on_both_sides_in_the_summary() {
		// given
		UUID stockId = UUID.randomUUID();
		given(this.applicationService.findIdByName("order-service")).willReturn(this.providerId);
		given(this.deploymentService.findDeploymentInfoByEnvironment("staging"))
			.willReturn(List.of(new DeploymentInfo(this.consumerId, "2.0.0"), new DeploymentInfo(stockId, "5.0.0")));
		given(this.verificationService.findConsumerIdsByProviderId(this.providerId))
			.willReturn(Set.of(this.consumerId));
		given(this.verificationService.findProviderIdsByConsumerId(this.providerId)).willReturn(Set.of(stockId));
		given(this.applicationService.findNameById(this.consumerId)).willReturn("payment-service");
		given(this.applicationService.findNameById(stockId)).willReturn("stock-service");
		given(this.verificationService.hasSuccessfulVerification(this.providerId, "1.0.0", this.consumerId, "2.0.0"))
			.willReturn(false);
		given(this.verificationService.hasSuccessfulVerification(stockId, "5.0.0", this.providerId, "1.0.0"))
			.willReturn(false);

		// when
		CanIDeployResponse result = this.canIDeployService.check("order-service", "1.0.0", "staging");

		// then
		assertThat(result.safe()).isFalse();
		assertThat(result.summary())
			.isEqualTo("1 of 1 consumer(s) and 1 of 1 provider(s) missing successful verification");
	}

	@Test
	void should_name_only_the_failing_side_when_the_other_side_is_fully_verified() {
		// given — the consumer side is fine, the provider side is not
		UUID stockId = UUID.randomUUID();
		given(this.applicationService.findIdByName("order-service")).willReturn(this.providerId);
		given(this.deploymentService.findDeploymentInfoByEnvironment("staging"))
			.willReturn(List.of(new DeploymentInfo(this.consumerId, "2.0.0"), new DeploymentInfo(stockId, "5.0.0")));
		given(this.verificationService.findConsumerIdsByProviderId(this.providerId))
			.willReturn(Set.of(this.consumerId));
		given(this.verificationService.findProviderIdsByConsumerId(this.providerId)).willReturn(Set.of(stockId));
		given(this.applicationService.findNameById(this.consumerId)).willReturn("payment-service");
		given(this.applicationService.findNameById(stockId)).willReturn("stock-service");
		given(this.verificationService.hasSuccessfulVerification(this.providerId, "1.0.0", this.consumerId, "2.0.0"))
			.willReturn(true);
		given(this.verificationService.hasSuccessfulVerification(stockId, "5.0.0", this.providerId, "1.0.0"))
			.willReturn(false);

		// when
		CanIDeployResponse result = this.canIDeployService.check("order-service", "1.0.0", "staging");

		// then
		assertThat(result.safe()).isFalse();
		assertThat(result.summary()).isEqualTo("1 of 1 provider(s) missing successful verification");
	}

}
