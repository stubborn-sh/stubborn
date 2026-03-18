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

import org.jspecify.annotations.Nullable;

import org.springframework.cloud.contract.broker.application.ApplicationService;
import org.springframework.cloud.contract.broker.environment.DeploymentService;
import org.springframework.cloud.contract.broker.verification.VerificationService;

/**
 * OSS default implementation of {@link DeploymentSafetyChecker}. Evaluates consumers by
 * direct version-to-version verification matching. The {@code branch} parameter is
 * accepted but ignored.
 */
class OssDeploymentSafetyChecker implements DeploymentSafetyChecker {

	private final ApplicationService applicationService;

	private final DeploymentService deploymentService;

	private final VerificationService verificationService;

	OssDeploymentSafetyChecker(ApplicationService applicationService, DeploymentService deploymentService,
			VerificationService verificationService) {
		this.applicationService = applicationService;
		this.deploymentService = deploymentService;
		this.verificationService = verificationService;
	}

	@Override
	public List<ConsumerResult> evaluateConsumers(UUID providerId, String providerVersion, String environment,
			@Nullable String branch) {
		return this.deploymentService.findDeploymentInfoByEnvironment(environment)
			.stream()
			.filter(info -> !info.applicationId().equals(providerId))
			.map(info -> {
				String consumerName = this.applicationService.findNameById(info.applicationId());
				boolean verified = this.verificationService.hasSuccessfulVerification(providerId, providerVersion,
						info.applicationId(), info.version());
				return new ConsumerResult(consumerName, info.version(), verified);
			})
			.toList();
	}

}
