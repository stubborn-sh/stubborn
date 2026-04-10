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
package sh.stubborn.oss.selector;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

import io.micrometer.observation.annotation.Observed;
import org.jspecify.annotations.Nullable;

import sh.stubborn.oss.application.ApplicationService;
import sh.stubborn.oss.contract.ContractService;
import sh.stubborn.oss.environment.DeploymentInfo;
import sh.stubborn.oss.environment.DeploymentService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SelectorService {

	private final ContractService contractService;

	private final ApplicationService applicationService;

	private final DeploymentService deploymentService;

	SelectorService(ContractService contractService, ApplicationService applicationService,
			DeploymentService deploymentService) {
		this.contractService = contractService;
		this.applicationService = applicationService;
		this.deploymentService = deploymentService;
	}

	@Observed(name = "broker.selector.resolve")
	@Transactional(readOnly = true)
	public List<ResolvedContract> resolve(List<ConsumerVersionSelector> selectors) {
		Set<String> seen = new LinkedHashSet<>();
		List<ResolvedContract> results = new ArrayList<>();
		for (ConsumerVersionSelector selector : selectors) {
			List<ResolvedContract> resolved = resolveSelector(selector);
			for (ResolvedContract contract : resolved) {
				String key = contract.consumerName() + ":" + contract.version() + ":" + contract.contractName();
				if (seen.add(key)) {
					results.add(contract);
				}
			}
		}
		return results;
	}

	private List<ResolvedContract> resolveSelector(ConsumerVersionSelector selector) {
		if (Boolean.TRUE.equals(selector.mainBranch())) {
			return resolveMainBranch();
		}
		if (selector.branch() != null) {
			return resolveBranch(selector.branch(), selector.consumer());
		}
		if (Boolean.TRUE.equals(selector.deployed()) && selector.environment() != null) {
			return resolveDeployed(selector.environment());
		}
		if (selector.consumer() != null) {
			return resolveConsumer(selector.consumer());
		}
		return List.of();
	}

	private List<ResolvedContract> resolveMainBranch() {
		List<ResolvedContract> results = new ArrayList<>();
		for (var info : this.applicationService.findAllInfo()) {
			String mainBranch = this.applicationService.findMainBranchByName(info.name());
			var contracts = this.contractService.findInfoByApplicationAndBranch(info.name(), mainBranch);
			for (var contract : contracts) {
				results.add(new ResolvedContract(info.name(), contract.version(), mainBranch, contract.contractName(),
						contract.contentHash()));
			}
		}
		return results;
	}

	private List<ResolvedContract> resolveBranch(String branch, @Nullable String consumer) {
		List<ResolvedContract> results = new ArrayList<>();
		if (consumer != null) {
			var contracts = this.contractService.findInfoByApplicationAndBranch(consumer, branch);
			for (var contract : contracts) {
				results.add(new ResolvedContract(consumer, contract.version(), branch, contract.contractName(),
						contract.contentHash()));
			}
		}
		else {
			for (var info : this.applicationService.findAllInfo()) {
				var contracts = this.contractService.findInfoByApplicationAndBranch(info.name(), branch);
				for (var contract : contracts) {
					results.add(new ResolvedContract(info.name(), contract.version(), branch, contract.contractName(),
							contract.contentHash()));
				}
			}
		}
		return results;
	}

	private List<ResolvedContract> resolveDeployed(String environment) {
		List<ResolvedContract> results = new ArrayList<>();
		var deployments = this.deploymentService.findDeploymentInfoByEnvironment(environment);
		for (DeploymentInfo deployment : deployments) {
			String appName = this.applicationService.findNameById(deployment.applicationId());
			var contracts = this.contractService.findInfoByApplicationAndVersion(appName, deployment.version());
			for (var contract : contracts) {
				results.add(new ResolvedContract(appName, contract.version(), contract.branch(),
						contract.contractName(), contract.contentHash()));
			}
		}
		return results;
	}

	private List<ResolvedContract> resolveConsumer(String consumer) {
		List<ResolvedContract> results = new ArrayList<>();
		String mainBranch = this.applicationService.findMainBranchByName(consumer);
		var contracts = this.contractService.findInfoByApplicationAndBranch(consumer, mainBranch);
		for (var contract : contracts) {
			results.add(new ResolvedContract(consumer, contract.version(), mainBranch, contract.contractName(),
					contract.contentHash()));
		}
		return results;
	}

}
