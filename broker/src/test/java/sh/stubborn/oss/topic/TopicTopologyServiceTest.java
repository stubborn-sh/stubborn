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
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import sh.stubborn.oss.application.ApplicationInfo;
import sh.stubborn.oss.application.ApplicationService;
import sh.stubborn.oss.contract.ContractService;
import sh.stubborn.oss.contract.ContractTopicInfo;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.BDDMockito.given;

/**
 * Tests for {@link TopicTopologyService}.
 *
 * @see TopicTopologyService
 */
@ExtendWith(MockitoExtension.class)
class TopicTopologyServiceTest {

	@Mock
	ContractService contractService;

	@Mock
	ApplicationService applicationService;

	TopicTopologyService service;

	@BeforeEach
	void setUp() {
		this.service = new TopicTopologyService(this.contractService, this.applicationService);
	}

	@Test
	void should_return_empty_topology_when_no_topics() {
		// given
		given(this.contractService.findDistinctTopicNames()).willReturn(List.of());
		given(this.applicationService.findAllInfo()).willReturn(List.of());

		// when
		TopicTopologyResponse response = this.service.getTopology();

		// then
		assertThat(response.topics()).isEmpty();
	}

	@Test
	void should_return_topology_with_publishers() {
		// given
		UUID appId = UUID.randomUUID();
		ApplicationInfo appInfo = new ApplicationInfo(appId, "order-service", "team-commerce");
		ContractTopicInfo topicInfo = new ContractTopicInfo(appId, "1.0.0", "verifications", "PUBLISH");

		given(this.contractService.findDistinctTopicNames()).willReturn(List.of("verifications"));
		given(this.applicationService.findAllInfo()).willReturn(List.of(appInfo));
		given(this.contractService.findTopicsByTopicName("verifications")).willReturn(List.of(topicInfo));

		// when
		TopicTopologyResponse response = this.service.getTopology();

		// then
		assertThat(response.topics()).hasSize(1);
		TopicNode node = response.topics().get(0);
		assertThat(node.topicName()).isEqualTo("verifications");
		assertThat(node.publishers()).hasSize(1);
		TopicParticipant publisher = node.publishers().get(0);
		assertThat(publisher.applicationName()).isEqualTo("order-service");
		assertThat(publisher.version()).isEqualTo("1.0.0");
	}

	@Test
	void should_return_topic_by_name_with_correct_publishers() {
		// given
		UUID appId = UUID.randomUUID();
		ApplicationInfo appInfo = new ApplicationInfo(appId, "order-service", "team-commerce");
		ContractTopicInfo topicInfo = new ContractTopicInfo(appId, "2.0.0", "verifications", "PUBLISH");

		given(this.applicationService.findAllInfo()).willReturn(List.of(appInfo));
		given(this.contractService.findTopicsByTopicName("verifications")).willReturn(List.of(topicInfo));

		// when
		TopicNode node = this.service.getTopicByName("verifications");

		// then
		assertThat(node.topicName()).isEqualTo("verifications");
		assertThat(node.publishers()).hasSize(1);
		assertThat(node.publishers().get(0).applicationName()).isEqualTo("order-service");
		assertThat(node.publishers().get(0).version()).isEqualTo("2.0.0");
	}

	@Test
	void should_handle_unknown_application_in_topology() {
		// given
		UUID knownAppId = UUID.randomUUID();
		UUID unknownAppId = UUID.randomUUID();
		ApplicationInfo appInfo = new ApplicationInfo(knownAppId, "order-service", "team-commerce");
		ContractTopicInfo topicInfo = new ContractTopicInfo(unknownAppId, "1.0.0", "verifications", "PUBLISH");

		given(this.contractService.findDistinctTopicNames()).willReturn(List.of("verifications"));
		given(this.applicationService.findAllInfo()).willReturn(List.of(appInfo));
		given(this.contractService.findTopicsByTopicName("verifications")).willReturn(List.of(topicInfo));

		// when
		TopicTopologyResponse response = this.service.getTopology();

		// then
		assertThat(response.topics()).hasSize(1);
		TopicParticipant publisher = response.topics().get(0).publishers().get(0);
		assertThat(publisher.applicationName()).isEqualTo("unknown");
	}

	@Test
	void should_return_topics_for_application() {
		// given
		UUID appId = UUID.randomUUID();
		ApplicationInfo appInfo = new ApplicationInfo(appId, "order-service", "team-commerce");
		ContractTopicInfo topicInfo = new ContractTopicInfo(appId, "1.0.0", "verifications", "PUBLISH");

		given(this.contractService.findTopicsByApplicationName("order-service")).willReturn(List.of(topicInfo));
		given(this.applicationService.findAllInfo()).willReturn(List.of(appInfo));
		given(this.contractService.findTopicsByTopicName("verifications")).willReturn(List.of(topicInfo));

		// when
		TopicTopologyResponse response = this.service.getTopicsForApplication("order-service");

		// then
		assertThat(response.topics()).hasSize(1);
		assertThat(response.topics().get(0).topicName()).isEqualTo("verifications");
		assertThat(response.topics().get(0).publishers().get(0).applicationName()).isEqualTo("order-service");
	}

	@Test
	void should_return_empty_when_application_has_no_topics() {
		// given
		given(this.contractService.findTopicsByApplicationName("order-service")).willReturn(List.of());
		given(this.applicationService.findAllInfo()).willReturn(List.of());

		// when
		TopicTopologyResponse response = this.service.getTopicsForApplication("order-service");

		// then
		assertThat(response.topics()).isEmpty();
	}

}
