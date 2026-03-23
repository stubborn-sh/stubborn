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
package sh.stubborn.broker.environment;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import sh.stubborn.broker.application.ApplicationNotFoundException;
import sh.stubborn.broker.application.ApplicationService;
import org.springframework.context.ApplicationEventPublisher;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.then;

@ExtendWith(MockitoExtension.class)
class DeploymentServiceTest {

	@Mock
	DeploymentRepository deploymentRepository;

	@Mock
	ApplicationService applicationService;

	@Mock
	ApplicationEventPublisher eventPublisher;

	@Mock
	EnvironmentService environmentService;

	DeploymentService deploymentService;

	UUID applicationId;

	@BeforeEach
	void setUp() {
		this.deploymentService = new DeploymentService(this.deploymentRepository, this.applicationService,
				this.eventPublisher, this.environmentService);
		this.applicationId = UUID.randomUUID();
	}

	@Test
	void should_create_new_deployment_when_none_exists() {
		// given
		given(this.applicationService.findIdByName("order-service")).willReturn(this.applicationId);
		given(this.deploymentRepository.findByApplicationIdAndEnvironment(this.applicationId, "staging"))
			.willReturn(Optional.empty());
		given(this.deploymentRepository.save(any(Deployment.class)))
			.willAnswer(invocation -> invocation.getArgument(0));

		// when
		Deployment result = this.deploymentService.recordDeployment("staging", "order-service", "1.0.0");

		// then
		assertThat(result.getEnvironment()).isEqualTo("staging");
		assertThat(result.getVersion()).isEqualTo("1.0.0");
		assertThat(result.getApplicationId()).isEqualTo(this.applicationId);
		then(this.deploymentRepository).should().save(any(Deployment.class));
	}

	@Test
	void should_update_existing_deployment_version() {
		// given
		given(this.applicationService.findIdByName("order-service")).willReturn(this.applicationId);
		Deployment existing = Deployment.create(this.applicationId, "staging", "1.0.0");
		given(this.deploymentRepository.findByApplicationIdAndEnvironment(this.applicationId, "staging"))
			.willReturn(Optional.of(existing));
		given(this.deploymentRepository.save(any(Deployment.class)))
			.willAnswer(invocation -> invocation.getArgument(0));

		// when
		Deployment result = this.deploymentService.recordDeployment("staging", "order-service", "2.0.0");

		// then — verify result is the saved entity (kills null-return mutation on map
		// lambda)
		assertThat(result).isNotNull();
		assertThat(result).isSameAs(existing);
		assertThat(result.getVersion()).isEqualTo("2.0.0");
		assertThat(result.getApplicationId()).isEqualTo(this.applicationId);
		then(this.deploymentRepository).should().save(existing);
	}

	@Test
	void should_throw_when_application_not_found() {
		// given
		given(this.applicationService.findIdByName("unknown")).willThrow(new ApplicationNotFoundException("unknown"));

		// when/then
		assertThatThrownBy(() -> this.deploymentService.recordDeployment("staging", "unknown", "1.0.0"))
			.isInstanceOf(ApplicationNotFoundException.class);
	}

	@Test
	void should_throw_when_environment_name_invalid() {
		// when/then
		assertThatThrownBy(() -> this.deploymentService.recordDeployment("INVALID", "order-service", "1.0.0"))
			.isInstanceOf(IllegalArgumentException.class);
	}

	@Test
	void should_throw_when_version_invalid() {
		// when/then
		assertThatThrownBy(() -> this.deploymentService.recordDeployment("staging", "order-service", "bad"))
			.isInstanceOf(IllegalArgumentException.class);
	}

	@Test
	void should_find_deployments_by_environment() {
		// given
		Deployment d = Deployment.create(this.applicationId, "staging", "1.0.0");
		given(this.deploymentRepository.findByEnvironment("staging")).willReturn(List.of(d));

		// when
		List<Deployment> result = this.deploymentService.findByEnvironment("staging");

		// then
		assertThat(result).hasSize(1);
		assertThat(result.get(0).getVersion()).isEqualTo("1.0.0");
	}

	@Test
	void should_find_deployment_by_environment_and_application() {
		// given
		given(this.applicationService.findIdByName("order-service")).willReturn(this.applicationId);
		Deployment d = Deployment.create(this.applicationId, "staging", "1.0.0");
		given(this.deploymentRepository.findByApplicationIdAndEnvironment(this.applicationId, "staging"))
			.willReturn(Optional.of(d));

		// when
		Deployment result = this.deploymentService.findByEnvironmentAndApplication("staging", "order-service");

		// then
		assertThat(result.getVersion()).isEqualTo("1.0.0");
	}

	@Test
	void should_throw_when_deployment_not_found() {
		// given
		given(this.applicationService.findIdByName("order-service")).willReturn(this.applicationId);
		given(this.deploymentRepository.findByApplicationIdAndEnvironment(this.applicationId, "staging"))
			.willReturn(Optional.empty());

		// when/then
		assertThatThrownBy(() -> this.deploymentService.findByEnvironmentAndApplication("staging", "order-service"))
			.isInstanceOf(DeploymentNotFoundException.class);
	}

}
