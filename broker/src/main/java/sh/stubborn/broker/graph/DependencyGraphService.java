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

import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

import io.micrometer.observation.annotation.Observed;
import org.jspecify.annotations.Nullable;

import org.springframework.cache.annotation.Cacheable;
import sh.stubborn.broker.application.ApplicationInfo;
import sh.stubborn.broker.application.ApplicationService;
import sh.stubborn.broker.environment.DeploymentInfo;
import sh.stubborn.broker.environment.DeploymentService;
import sh.stubborn.broker.verification.VerificationInfo;
import sh.stubborn.broker.verification.VerificationService;
import org.springframework.stereotype.Service;

@Service
public class DependencyGraphService {

	private final VerificationService verificationService;

	private final ApplicationService applicationService;

	private final DeploymentService deploymentService;

	DependencyGraphService(VerificationService verificationService, ApplicationService applicationService,
			DeploymentService deploymentService) {
		this.verificationService = verificationService;
		this.applicationService = applicationService;
		this.deploymentService = deploymentService;
	}

	@Observed(name = "broker.graph.query")
	@Cacheable(cacheNames = "graph", key = "'graph:' + (#environment != null ? #environment : 'all')")
	DependencyGraphResponse getGraph(@Nullable String environment) {
		Map<UUID, ApplicationInfo> appsById = this.applicationService.findAllInfo()
			.stream()
			.collect(Collectors.toMap(ApplicationInfo::id, Function.identity()));
		List<VerificationInfo> verifications = this.verificationService.findAllInfo();
		if (environment != null) {
			Map<UUID, String> deployedVersions = this.deploymentService.findDeploymentInfoByEnvironment(environment)
				.stream()
				.collect(Collectors.toMap(DeploymentInfo::applicationId, DeploymentInfo::version));
			verifications = verifications.stream().filter(v -> matchesDeployedVersion(v, deployedVersions)).toList();
		}
		Set<UUID> referencedAppIds = new HashSet<>();
		List<DependencyEdge> edges = verifications.stream().map(v -> {
			referencedAppIds.add(v.providerId());
			referencedAppIds.add(v.consumerId());
			String providerName = resolveName(appsById, v.providerId());
			String consumerName = resolveName(appsById, v.consumerId());
			return new DependencyEdge(providerName, v.providerVersion(), consumerName, v.consumerVersion(), v.status(),
					v.verifiedAt());
		}).toList();
		List<DependencyNode> nodes = referencedAppIds.stream().map(id -> {
			ApplicationInfo app = appsById.get(id);
			if (app != null) {
				return new DependencyNode(app.id(), app.name(), app.owner());
			}
			return new DependencyNode(id, "unknown", "unknown");
		}).toList();
		return new DependencyGraphResponse(nodes, edges);
	}

	ApplicationDependenciesResponse getApplicationDependencies(String applicationName) {
		UUID appId = this.applicationService.findIdByName(applicationName);
		List<VerificationInfo> asConsumer = this.verificationService.findInfoByConsumerId(appId);
		List<VerificationInfo> asProvider = this.verificationService.findInfoByProviderId(appId);
		List<DependencyEdge> providers = asConsumer.stream()
			.map(v -> new DependencyEdge(this.verificationService.resolveApplicationName(v.providerId()),
					v.providerVersion(), applicationName, v.consumerVersion(), v.status(), v.verifiedAt()))
			.toList();
		List<DependencyEdge> consumers = asProvider.stream()
			.map(v -> new DependencyEdge(applicationName, v.providerVersion(),
					this.verificationService.resolveApplicationName(v.consumerId()), v.consumerVersion(), v.status(),
					v.verifiedAt()))
			.toList();
		return new ApplicationDependenciesResponse(applicationName, providers, consumers);
	}

	private boolean matchesDeployedVersion(VerificationInfo verification, Map<UUID, String> deployedVersions) {
		String deployedProviderVersion = deployedVersions.get(verification.providerId());
		String deployedConsumerVersion = deployedVersions.get(verification.consumerId());
		return verification.providerVersion().equals(deployedProviderVersion)
				&& verification.consumerVersion().equals(deployedConsumerVersion);
	}

	private String resolveName(Map<UUID, ApplicationInfo> appsById, UUID appId) {
		ApplicationInfo app = appsById.get(appId);
		return app != null ? app.name() : "unknown";
	}

}
