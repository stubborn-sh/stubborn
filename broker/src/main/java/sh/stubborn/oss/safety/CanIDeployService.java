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
import java.util.UUID;

import io.micrometer.observation.annotation.Observed;
import org.jspecify.annotations.Nullable;

import org.springframework.cache.annotation.Cacheable;
import sh.stubborn.oss.application.ApplicationService;
import sh.stubborn.oss.contract.ContractVersion;
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
		UUID applicationId = this.applicationService.findIdByName(applicationName);
		List<ConsumerResult> consumerResults = this.deploymentSafetyChecker.evaluateConsumers(applicationId, version,
				environment, branch);
		List<ProviderResult> providerResults = this.deploymentSafetyChecker.evaluateProviders(applicationId, version,
				environment, branch);
		boolean safe = consumerResults.stream().allMatch(ConsumerResult::verified)
				&& providerResults.stream().allMatch(ProviderResult::verified);
		String summary = buildSummary(consumerResults, providerResults, safe);
		return new CanIDeployResponse(applicationName, version, environment, branch, safe, summary, consumerResults,
				providerResults);
	}

	CanIDeployResponse check(String applicationName, String version, String environment) {
		return check(applicationName, version, environment, null);
	}

	private String buildSummary(List<ConsumerResult> consumers, List<ProviderResult> providers, boolean safe) {
		if (consumers.isEmpty() && providers.isEmpty()) {
			return "No consumers or providers of this application deployed to this environment";
		}
		long failedConsumers = consumers.stream().filter(r -> !r.verified()).count();
		long failedProviders = providers.stream().filter(r -> !r.verified()).count();
		if (safe) {
			return "All " + join(count(consumers.size(), "consumer"), count(providers.size(), "provider"))
					+ " verified successfully";
		}
		return join(ratio(failedConsumers, consumers.size(), "consumer"),
				ratio(failedProviders, providers.size(), "provider")) + " missing successful verification";
	}

	private static String count(int total, String noun) {
		return (total == 0) ? "" : total + " " + noun + "(s)";
	}

	private static String ratio(long failed, int total, String noun) {
		return (failed == 0) ? "" : failed + " of " + total + " " + noun + "(s)";
	}

	private static String join(String consumerPart, String providerPart) {
		if (consumerPart.isEmpty()) {
			return providerPart;
		}
		if (providerPart.isEmpty()) {
			return consumerPart;
		}
		return consumerPart + " and " + providerPart;
	}

}
