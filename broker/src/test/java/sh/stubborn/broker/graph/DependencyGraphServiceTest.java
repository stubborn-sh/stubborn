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
package sh.stubborn.broker.graph;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import sh.stubborn.broker.application.ApplicationInfo;
import sh.stubborn.broker.application.ApplicationService;
import sh.stubborn.broker.environment.DeploymentInfo;
import sh.stubborn.broker.environment.DeploymentService;
import sh.stubborn.broker.verification.VerificationInfo;
import sh.stubborn.broker.verification.VerificationService;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.BDDMockito.given;

@ExtendWith(MockitoExtension.class)
class DependencyGraphServiceTest {

	@Mock
	VerificationService verificationService;

	@Mock
	ApplicationService applicationService;

	@Mock
	DeploymentService deploymentService;

	DependencyGraphService graphService;

	UUID providerId;

	UUID consumerId;

	@BeforeEach
	void setUp() {
		this.graphService = new DependencyGraphService(this.verificationService, this.applicationService,
				this.deploymentService);
		this.providerId = UUID.randomUUID();
		this.consumerId = UUID.randomUUID();
	}

	@Test
	void should_return_empty_graph_when_no_verifications() {
		// given
		given(this.applicationService.findAllInfo()).willReturn(List.of());
		given(this.verificationService.findAllInfo()).willReturn(List.of());

		// when
		DependencyGraphResponse result = this.graphService.getGraph(null);

		// then
		assertThat(result.nodes()).isEmpty();
		assertThat(result.edges()).isEmpty();
	}

	@Test
	void should_return_graph_with_nodes_and_edges() {
		// given
		given(this.applicationService.findAllInfo())
			.willReturn(List.of(new ApplicationInfo(this.providerId, "order-service", "team-commerce"),
					new ApplicationInfo(this.consumerId, "payment-service", "team-payments")));
		given(this.verificationService.findAllInfo()).willReturn(List.of(new VerificationInfo(this.providerId, "1.0.0",
				this.consumerId, "2.0.0", "SUCCESS", null, Instant.parse("2026-01-15T10:00:00Z"))));

		// when
		DependencyGraphResponse result = this.graphService.getGraph(null);

		// then
		assertThat(result.nodes()).hasSize(2);
		assertThat(result.edges()).hasSize(1);
		DependencyEdge edge = result.edges().get(0);
		assertThat(edge.providerName()).isEqualTo("order-service");
		assertThat(edge.providerVersion()).isEqualTo("1.0.0");
		assertThat(edge.consumerName()).isEqualTo("payment-service");
		assertThat(edge.consumerVersion()).isEqualTo("2.0.0");
		assertThat(edge.status()).isEqualTo("SUCCESS");
		DependencyNode providerNode = result.nodes()
			.stream()
			.filter(n -> n.applicationId().equals(this.providerId))
			.findFirst()
			.orElseThrow();
		assertThat(providerNode.applicationName()).isEqualTo("order-service");
		assertThat(providerNode.owner()).isEqualTo("team-commerce");
		DependencyNode consumerNode = result.nodes()
			.stream()
			.filter(n -> n.applicationId().equals(this.consumerId))
			.findFirst()
			.orElseThrow();
		assertThat(consumerNode.applicationName()).isEqualTo("payment-service");
		assertThat(consumerNode.owner()).isEqualTo("team-payments");
	}

	@Test
	void should_filter_graph_by_environment() {
		// given
		given(this.applicationService.findAllInfo())
			.willReturn(List.of(new ApplicationInfo(this.providerId, "order-service", "team-commerce"),
					new ApplicationInfo(this.consumerId, "payment-service", "team-payments")));
		given(this.verificationService.findAllInfo()).willReturn(List.of(
				new VerificationInfo(this.providerId, "1.0.0", this.consumerId, "2.0.0", "SUCCESS", null,
						Instant.parse("2026-01-15T10:00:00Z")),
				new VerificationInfo(this.providerId, "1.1.0", this.consumerId, "2.0.0", "SUCCESS", null,
						Instant.parse("2026-01-16T10:00:00Z"))));
		given(this.deploymentService.findDeploymentInfoByEnvironment("prod")).willReturn(
				List.of(new DeploymentInfo(this.providerId, "1.0.0"), new DeploymentInfo(this.consumerId, "2.0.0")));

		// when
		DependencyGraphResponse result = this.graphService.getGraph("prod");

		// then — only the verification matching deployed versions
		assertThat(result.edges()).hasSize(1);
		assertThat(result.edges().get(0).providerVersion()).isEqualTo("1.0.0");
	}

	@Test
	void should_return_application_dependencies_as_provider() {
		// given
		given(this.applicationService.findIdByName("order-service")).willReturn(this.providerId);
		given(this.verificationService.findInfoByConsumerId(this.providerId)).willReturn(List.of());
		given(this.verificationService.findInfoByProviderId(this.providerId))
			.willReturn(List.of(new VerificationInfo(this.providerId, "1.0.0", this.consumerId, "2.0.0", "SUCCESS",
					null, Instant.parse("2026-01-15T10:00:00Z"))));
		given(this.verificationService.resolveApplicationName(this.consumerId)).willReturn("payment-service");

		// when
		ApplicationDependenciesResponse result = this.graphService.getApplicationDependencies("order-service");

		// then
		assertThat(result.applicationName()).isEqualTo("order-service");
		assertThat(result.providers()).isEmpty();
		assertThat(result.consumers()).hasSize(1);
		assertThat(result.consumers().get(0).consumerName()).isEqualTo("payment-service");
	}

	@Test
	void should_return_application_dependencies_as_consumer() {
		// given
		given(this.applicationService.findIdByName("payment-service")).willReturn(this.consumerId);
		given(this.verificationService.findInfoByConsumerId(this.consumerId))
			.willReturn(List.of(new VerificationInfo(this.providerId, "1.0.0", this.consumerId, "2.0.0", "SUCCESS",
					null, Instant.parse("2026-01-15T10:00:00Z"))));
		given(this.verificationService.findInfoByProviderId(this.consumerId)).willReturn(List.of());
		given(this.verificationService.resolveApplicationName(this.providerId)).willReturn("order-service");

		// when
		ApplicationDependenciesResponse result = this.graphService.getApplicationDependencies("payment-service");

		// then
		assertThat(result.applicationName()).isEqualTo("payment-service");
		assertThat(result.providers()).hasSize(1);
		assertThat(result.providers().get(0).providerName()).isEqualTo("order-service");
		assertThat(result.consumers()).isEmpty();
	}

	@Test
	void should_use_unknown_node_when_application_not_found_in_graph() {
		// given
		UUID unknownAppId = UUID.randomUUID();
		given(this.applicationService.findAllInfo())
			.willReturn(List.of(new ApplicationInfo(this.providerId, "order-service", "team-commerce")));
		given(this.verificationService.findAllInfo()).willReturn(List.of(new VerificationInfo(this.providerId, "1.0.0",
				unknownAppId, "2.0.0", "SUCCESS", null, Instant.parse("2026-01-15T10:00:00Z"))));

		// when
		DependencyGraphResponse result = this.graphService.getGraph(null);

		// then
		assertThat(result.nodes()).hasSize(2);
		DependencyNode unknownNode = result.nodes()
			.stream()
			.filter(n -> n.applicationId().equals(unknownAppId))
			.findFirst()
			.orElseThrow();
		assertThat(unknownNode.applicationName()).isEqualTo("unknown");
		assertThat(unknownNode.owner()).isEqualTo("unknown");
		DependencyNode knownNode = result.nodes()
			.stream()
			.filter(n -> n.applicationId().equals(this.providerId))
			.findFirst()
			.orElseThrow();
		assertThat(knownNode.applicationName()).isEqualTo("order-service");
		assertThat(knownNode.owner()).isEqualTo("team-commerce");
		assertThat(result.edges().get(0).consumerName()).isEqualTo("unknown");
	}

	@Test
	void should_exclude_verification_when_consumer_version_does_not_match_deployed() {
		// given
		given(this.applicationService.findAllInfo())
			.willReturn(List.of(new ApplicationInfo(this.providerId, "order-service", "team-commerce"),
					new ApplicationInfo(this.consumerId, "payment-service", "team-payments")));
		given(this.verificationService.findAllInfo()).willReturn(List.of(new VerificationInfo(this.providerId, "1.0.0",
				this.consumerId, "2.0.0", "SUCCESS", null, Instant.parse("2026-01-15T10:00:00Z"))));
		given(this.deploymentService.findDeploymentInfoByEnvironment("prod")).willReturn(
				List.of(new DeploymentInfo(this.providerId, "1.0.0"), new DeploymentInfo(this.consumerId, "3.0.0")));

		// when
		DependencyGraphResponse result = this.graphService.getGraph("prod");

		// then
		assertThat(result.edges()).isEmpty();
	}

	@Test
	void should_exclude_verification_when_provider_version_does_not_match_deployed() {
		// given
		given(this.applicationService.findAllInfo())
			.willReturn(List.of(new ApplicationInfo(this.providerId, "order-service", "team-commerce"),
					new ApplicationInfo(this.consumerId, "payment-service", "team-payments")));
		given(this.verificationService.findAllInfo()).willReturn(List.of(new VerificationInfo(this.providerId, "1.0.0",
				this.consumerId, "2.0.0", "SUCCESS", null, Instant.parse("2026-01-15T10:00:00Z"))));
		given(this.deploymentService.findDeploymentInfoByEnvironment("prod")).willReturn(
				List.of(new DeploymentInfo(this.providerId, "9.0.0"), new DeploymentInfo(this.consumerId, "2.0.0")));

		// when
		DependencyGraphResponse result = this.graphService.getGraph("prod");

		// then
		assertThat(result.edges()).isEmpty();
	}

}
