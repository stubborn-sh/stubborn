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

import io.micrometer.observation.annotation.Observed;
import org.jspecify.annotations.Nullable;

import org.springframework.cache.annotation.Cacheable;
import org.springframework.cloud.contract.broker.application.ApplicationService;
import org.springframework.cloud.contract.broker.contract.ContractVersion;
import org.springframework.stereotype.Service;

@Service
public class CanIDeployService {

	private final ApplicationService applicationService;

	private final DeploymentSafetyChecker deploymentSafetyChecker;

	CanIDeployService(ApplicationService applicationService, DeploymentSafetyChecker deploymentSafetyChecker) {
		this.applicationService = applicationService;
		this.deploymentSafetyChecker = deploymentSafetyChecker;
	}

	@Observed(name = "broker.safety.check")
	@Cacheable(cacheNames = "safety",
			key = "'check:' + #applicationName + ':' + #version + ':' + #environment + ':' + (#branch != null ? #branch : '')")
	CanIDeployResponse check(String applicationName, String version, String environment, @Nullable String branch) {
		ContractVersion.of(version);
		UUID providerId = this.applicationService.findIdByName(applicationName);
		List<ConsumerResult> consumerResults = this.deploymentSafetyChecker.evaluateConsumers(providerId, version,
				environment, branch);
		boolean safe = consumerResults.stream().allMatch(ConsumerResult::verified);
		String summary = buildSummary(consumerResults, safe);
		return new CanIDeployResponse(applicationName, version, environment, branch, safe, summary, consumerResults);
	}

	CanIDeployResponse check(String applicationName, String version, String environment) {
		return check(applicationName, version, environment, null);
	}

	private String buildSummary(List<ConsumerResult> results, boolean safe) {
		if (results.isEmpty()) {
			return "No consumers deployed to this environment";
		}
		if (safe) {
			return "All " + results.size() + " consumer(s) verified successfully";
		}
		long failed = results.stream().filter(r -> !r.verified()).count();
		return failed + " of " + results.size() + " consumer(s) missing successful verification";
	}

}
