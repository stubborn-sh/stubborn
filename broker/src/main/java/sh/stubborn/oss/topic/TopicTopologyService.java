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
package sh.stubborn.oss.topic;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

import io.micrometer.observation.annotation.Observed;

import org.springframework.cache.annotation.Cacheable;
import sh.stubborn.oss.application.ApplicationInfo;
import sh.stubborn.oss.application.ApplicationService;
import sh.stubborn.oss.contract.ContractService;
import sh.stubborn.oss.contract.ContractTopicInfo;
import org.springframework.stereotype.Service;

@Service
public class TopicTopologyService {

	private final ContractService contractService;

	private final ApplicationService applicationService;

	TopicTopologyService(ContractService contractService, ApplicationService applicationService) {
		this.contractService = contractService;
		this.applicationService = applicationService;
	}

	@Observed(name = "broker.topic.topology")
	@Cacheable(cacheNames = "topics", key = "'topology'")
	TopicTopologyResponse getTopology() {
		List<String> topicNames = this.contractService.findDistinctTopicNames();
		Map<UUID, ApplicationInfo> appsById = this.applicationService.findAllInfo()
			.stream()
			.collect(Collectors.toMap(ApplicationInfo::id, Function.identity()));
		List<TopicNode> nodes = topicNames.stream().map(name -> buildTopicNode(name, appsById)).toList();
		return new TopicTopologyResponse(nodes);
	}

	TopicNode getTopicByName(String topicName) {
		Map<UUID, ApplicationInfo> appsById = this.applicationService.findAllInfo()
			.stream()
			.collect(Collectors.toMap(ApplicationInfo::id, Function.identity()));
		return buildTopicNode(topicName, appsById);
	}

	TopicTopologyResponse getTopicsForApplication(String applicationName) {
		List<ContractTopicInfo> topics = this.contractService.findTopicsByApplicationName(applicationName);
		Map<UUID, ApplicationInfo> appsById = this.applicationService.findAllInfo()
			.stream()
			.collect(Collectors.toMap(ApplicationInfo::id, Function.identity()));
		List<String> uniqueTopicNames = topics.stream().map(ContractTopicInfo::topicName).distinct().toList();
		List<TopicNode> nodes = uniqueTopicNames.stream().map(name -> buildTopicNode(name, appsById)).toList();
		return new TopicTopologyResponse(nodes);
	}

	private TopicNode buildTopicNode(String topicName, Map<UUID, ApplicationInfo> appsById) {
		List<ContractTopicInfo> topics = this.contractService.findTopicsByTopicName(topicName);
		List<TopicParticipant> publishers = topics.stream().map(t -> {
			ApplicationInfo app = appsById.get(t.applicationId());
			String appName = app != null ? app.name() : "unknown";
			return new TopicParticipant(appName, t.version(), topicName);
		}).toList();
		return new TopicNode(topicName, publishers);
	}

}
