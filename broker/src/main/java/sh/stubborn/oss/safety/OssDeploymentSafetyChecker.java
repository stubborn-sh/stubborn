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

import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import org.jspecify.annotations.Nullable;

import sh.stubborn.oss.application.ApplicationService;
import sh.stubborn.oss.dependency.DependencyService;
import sh.stubborn.oss.environment.DeploymentInfo;
import sh.stubborn.oss.environment.DeploymentService;
import sh.stubborn.oss.verification.VerificationService;

/**
 * OSS default implementation of {@link DeploymentSafetyChecker}. Evaluates consumers by
 * direct version-to-version verification matching. Only applications that are known
 * consumers of the provider are considered — an application that merely happens to be
 * deployed to the same environment is not treated as a consumer. A consumer is known
 * either because it declared a dependency on the provider or because it has verified
 * against it before; a declaration alone is enough, so a consumer that has never verified
 * is evaluated rather than overlooked. The {@code branch} parameter is accepted but
 * ignored.
 */
class OssDeploymentSafetyChecker implements DeploymentSafetyChecker {

	private final ApplicationService applicationService;

	private final DeploymentService deploymentService;

	private final VerificationService verificationService;

	private final DependencyService dependencyService;

	OssDeploymentSafetyChecker(ApplicationService applicationService, DeploymentService deploymentService,
			VerificationService verificationService, DependencyService dependencyService) {
		this.applicationService = applicationService;
		this.deploymentService = deploymentService;
		this.verificationService = verificationService;
		this.dependencyService = dependencyService;
	}

	@Override
	public List<ConsumerResult> evaluateConsumers(UUID providerId, String providerVersion, String environment,
			@Nullable String branch) {
		List<DeploymentInfo> deployed = this.deploymentService.findDeploymentInfoByEnvironment(environment);
		if (deployed.isEmpty()) {
			return List.of();
		}
		Set<UUID> knownConsumerIds = knownConsumerIds(providerId);
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

	/**
	 * Applications that declared a dependency on the provider, plus those that have
	 * verified against it at least once. The union matters in both directions: a
	 * declaration catches a consumer that has not verified yet, and verification history
	 * keeps evaluating consumers that predate declarations or never adopted them.
	 */
	private Set<UUID> knownConsumerIds(UUID providerId) {
		Set<UUID> declared = this.dependencyService.findConsumerIdsByProviderId(providerId);
		Set<UUID> verified = this.verificationService.findConsumerIdsByProviderId(providerId);
		if (declared.isEmpty()) {
			return verified;
		}
		if (verified.isEmpty()) {
			return declared;
		}
		Set<UUID> all = new HashSet<>(declared);
		all.addAll(verified);
		return all;
	}

}
