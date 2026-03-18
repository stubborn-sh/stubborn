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
package org.springframework.cloud.contract.broker.maintenance;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

import io.micrometer.observation.annotation.Observed;
import org.jspecify.annotations.Nullable;

import org.springframework.cloud.contract.broker.application.ApplicationInfo;
import org.springframework.cloud.contract.broker.application.ApplicationService;
import org.springframework.cloud.contract.broker.contract.ContractInfo;
import org.springframework.cloud.contract.broker.contract.ContractService;
import org.springframework.cloud.contract.broker.environment.DeploymentInfo;
import org.springframework.cloud.contract.broker.environment.DeploymentService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CleanupService {

	private final ContractService contractService;

	private final ApplicationService applicationService;

	private final DeploymentService deploymentService;

	CleanupService(ContractService contractService, ApplicationService applicationService,
			DeploymentService deploymentService) {
		this.contractService = contractService;
		this.applicationService = applicationService;
		this.deploymentService = deploymentService;
	}

	@Observed(name = "broker.maintenance.cleanup")
	@Transactional
	public CleanupResult cleanup(@Nullable String applicationName, int keepLatestVersions,
			List<String> protectedEnvironments) {
		List<ApplicationInfo> apps;
		if (applicationName != null) {
			ApplicationInfo info = toInfo(applicationName);
			apps = List.of(info);
		}
		else {
			apps = this.applicationService.findAllInfo();
		}
		int totalDeleted = 0;
		List<String> deletedContracts = new ArrayList<>();
		for (ApplicationInfo app : apps) {
			int deleted = cleanupApplication(app.name(), keepLatestVersions, protectedEnvironments, deletedContracts);
			totalDeleted += deleted;
		}
		return new CleanupResult(totalDeleted, deletedContracts);
	}

	private int cleanupApplication(String appName, int keepLatestVersions, List<String> protectedEnvironments,
			List<String> deletedContracts) {
		Set<String> protectedVersions = new LinkedHashSet<>();
		for (String env : protectedEnvironments) {
			List<DeploymentInfo> deployments = this.deploymentService.findDeploymentInfoByEnvironment(env);
			for (DeploymentInfo deployment : deployments) {
				String deployedAppName = this.applicationService.findNameById(deployment.applicationId());
				if (deployedAppName.equals(appName)) {
					protectedVersions.add(deployment.version());
				}
			}
		}
		String mainBranch = this.applicationService.findMainBranchByName(appName);
		List<ContractInfo> allContracts = this.contractService.findInfoByApplicationAndBranch(appName, mainBranch);
		Set<String> latestVersions = new LinkedHashSet<>();
		List<String> uniqueVersions = allContracts.stream().map(ContractInfo::version).distinct().toList();
		int keep = Math.min(keepLatestVersions, uniqueVersions.size());
		for (int i = 0; i < keep; i++) {
			latestVersions.add(uniqueVersions.get(i));
		}
		int deleted = 0;
		for (ContractInfo contract : allContracts) {
			if (!protectedVersions.contains(contract.version()) && !latestVersions.contains(contract.version())) {
				this.contractService.delete(appName, contract.version(), contract.contractName());
				deletedContracts.add(appName + ":" + contract.version() + ":" + contract.contractName());
				deleted++;
			}
		}
		return deleted;
	}

	private ApplicationInfo toInfo(String appName) {
		return new ApplicationInfo(this.applicationService.findIdByName(appName), appName,
				this.applicationService.findOwnerById(this.applicationService.findIdByName(appName)));
	}

}
