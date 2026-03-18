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
package org.springframework.cloud.contract.broker.environment;

import java.util.List;
import java.util.UUID;

import io.micrometer.observation.annotation.Observed;

import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.cache.annotation.Caching;
import org.springframework.cloud.contract.broker.application.ApplicationService;
import org.springframework.cloud.contract.broker.contract.ContractVersion;
import org.springframework.cloud.contract.broker.webhook.BrokerEvent;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class DeploymentService {

	private final DeploymentRepository deploymentRepository;

	private final ApplicationService applicationService;

	private final ApplicationEventPublisher eventPublisher;

	private final EnvironmentService environmentService;

	DeploymentService(DeploymentRepository deploymentRepository, ApplicationService applicationService,
			ApplicationEventPublisher eventPublisher, EnvironmentService environmentService) {
		this.deploymentRepository = deploymentRepository;
		this.applicationService = applicationService;
		this.eventPublisher = eventPublisher;
		this.environmentService = environmentService;
	}

	@Observed(name = "broker.deployment.record")
	@Transactional
	@Caching(evict = { @CacheEvict(cacheNames = "environments", allEntries = true),
			@CacheEvict(cacheNames = "safety", allEntries = true) })
	public Deployment recordDeployment(String environment, String applicationName, String version) {
		EnvironmentName.of(environment);
		ContractVersion.of(version);
		this.environmentService.ensureExists(environment);
		UUID applicationId = this.applicationService.findIdByName(applicationName);
		Deployment saved = this.deploymentRepository.findByApplicationIdAndEnvironment(applicationId, environment)
			.map(existing -> {
				existing.updateVersion(version);
				return this.deploymentRepository.save(existing);
			})
			.orElseGet(() -> {
				Deployment deployment = Deployment.create(applicationId, environment, version);
				return this.deploymentRepository.save(deployment);
			});
		this.eventPublisher
			.publishEvent(BrokerEvent.deploymentRecorded(applicationId, applicationName, version, environment));
		return saved;
	}

	public List<Deployment> findByEnvironment(String environment) {
		return this.deploymentRepository.findByEnvironment(environment);
	}

	public Page<Deployment> findByEnvironment(String environment, Pageable pageable) {
		return this.deploymentRepository.findByEnvironment(environment, pageable);
	}

	public Page<DeploymentResponse> findResponsesByEnvironment(String environment, Pageable pageable) {
		return findByEnvironment(environment, pageable)
			.map(d -> DeploymentResponse.from(d, this.applicationService.findNameById(d.getApplicationId())));
	}

	public DeploymentResponse toResponse(Deployment deployment) {
		String name = this.applicationService.findNameById(deployment.getApplicationId());
		return DeploymentResponse.from(deployment, name);
	}

	@Cacheable(cacheNames = "environments", key = "'info:' + #environment")
	public List<DeploymentInfo> findDeploymentInfoByEnvironment(String environment) {
		return this.deploymentRepository.findByEnvironment(environment).stream().map(DeploymentInfo::from).toList();
	}

	public Deployment findByEnvironmentAndApplication(String environment, String applicationName) {
		UUID applicationId = this.applicationService.findIdByName(applicationName);
		return this.deploymentRepository.findByApplicationIdAndEnvironment(applicationId, environment)
			.orElseThrow(() -> new DeploymentNotFoundException(environment, applicationName));
	}

}
