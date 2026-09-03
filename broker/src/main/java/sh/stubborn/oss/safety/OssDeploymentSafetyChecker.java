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

import org.jspecify.annotations.Nullable;

import sh.stubborn.oss.application.ApplicationService;
import sh.stubborn.oss.environment.DeploymentInfo;
import sh.stubborn.oss.environment.DeploymentService;
import sh.stubborn.oss.verification.VerificationService;

/**
 * OSS default implementation of {@link DeploymentSafetyChecker}. Evaluates consumers by
 * direct version-to-version verification matching. Only applications that are known
 * consumers of the provider are considered — an application that merely happens to be
 * deployed to the same environment is not treated as a consumer. The {@code branch}
 * parameter is accepted but ignored.
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
		List<DeploymentInfo> deployed = this.deploymentService.findDeploymentInfoByEnvironment(environment);
		if (deployed.isEmpty()) {
			return List.of();
		}
		Set<UUID> knownConsumerIds = this.verificationService.findConsumerIdsByProviderId(providerId);
		return deployed.stream()
			.filter(info -> !info.applicationId().equals(providerId))
			.filter(info -> knownConsumerIds.contains(info.applicationId()))
			.map(info -> {
				String consumerName = this.applicationService.findNameById(info.applicationId());
				boolean verified = this.verificationService.hasSuccessfulVerification(providerId, providerVersion,
						info.applicationId(), info.version());
				return new ConsumerResult(consumerName, info.version(), verified);
			})
			.toList();
	}

}
