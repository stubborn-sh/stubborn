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

import org.junit.jupiter.api.Test;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.micrometer.tracing.test.autoconfigure.AutoConfigureTracing;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import sh.stubborn.oss.audit.AuditService;

import static org.hamcrest.Matchers.hasSize;
import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Tests for {@link TopicTopologyController}.
 *
 * @see TopicTopologyController
 */
@WebMvcTest(TopicTopologyController.class)
@AutoConfigureTracing
@WithMockUser(roles = "ADMIN")
class TopicTopologyControllerTest {

	@Autowired
	MockMvc mockMvc;

	@MockitoBean
	TopicTopologyService topicTopologyService;

	@SuppressWarnings("unused")
	@MockitoBean
	AuditService auditService;

	@Test
	void should_return_topology() throws Exception {
		// given
		TopicParticipant participant = new TopicParticipant("order-service", "1.0.0", "verifications");
		TopicNode node = new TopicNode("verifications", List.of(participant));
		given(this.topicTopologyService.getTopology()).willReturn(new TopicTopologyResponse(List.of(node)));

		// when/then
		this.mockMvc.perform(get("/api/v1/topics"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.topics", hasSize(1)))
			.andExpect(jsonPath("$.topics[0].topicName").value("verifications"))
			.andExpect(jsonPath("$.topics[0].publishers[0].applicationName").value("order-service"));
	}

	@Test
	void should_return_empty_topology() throws Exception {
		// given
		given(this.topicTopologyService.getTopology()).willReturn(new TopicTopologyResponse(List.of()));

		// when/then
		this.mockMvc.perform(get("/api/v1/topics"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.topics", hasSize(0)));
	}

	@Test
	void should_return_topic_by_name() throws Exception {
		// given
		TopicParticipant participant = new TopicParticipant("order-service", "1.0.0", "verifications");
		TopicNode node = new TopicNode("verifications", List.of(participant));
		given(this.topicTopologyService.getTopicByName("verifications")).willReturn(node);

		// when/then
		this.mockMvc.perform(get("/api/v1/topics/verifications"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.topicName").value("verifications"))
			.andExpect(jsonPath("$.publishers", hasSize(1)))
			.andExpect(jsonPath("$.publishers[0].applicationName").value("order-service"));
	}

	@Test
	void should_return_topics_for_application() throws Exception {
		// given
		TopicParticipant participant = new TopicParticipant("order-service", "1.0.0", "verifications");
		TopicNode node = new TopicNode("verifications", List.of(participant));
		given(this.topicTopologyService.getTopicsForApplication("order-service"))
			.willReturn(new TopicTopologyResponse(List.of(node)));

		// when/then
		this.mockMvc.perform(get("/api/v1/topics/applications/order-service"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.topics", hasSize(1)))
			.andExpect(jsonPath("$.topics[0].topicName").value("verifications"))
			.andExpect(jsonPath("$.topics[0].publishers[0].applicationName").value("order-service"));
	}

}
