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
package sh.stubborn.oss.graph;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.Test;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.micrometer.tracing.test.autoconfigure.AutoConfigureTracing;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import sh.stubborn.oss.application.ApplicationNotFoundException;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import sh.stubborn.oss.audit.AuditService;
import org.springframework.test.web.servlet.MockMvc;

import static org.hamcrest.Matchers.hasSize;
import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(DependencyGraphController.class)
@AutoConfigureTracing
@WithMockUser(roles = "ADMIN")
class DependencyGraphControllerTest {

	@Autowired
	MockMvc mockMvc;

	@MockitoBean
	DependencyGraphService dependencyGraphService;

	@SuppressWarnings("unused")
	@MockitoBean
	AuditService auditService;

	@Test
	void should_return_full_graph_with_nodes_and_edges() throws Exception {
		// given
		UUID appId1 = UUID.randomUUID();
		UUID appId2 = UUID.randomUUID();
		DependencyNode node1 = new DependencyNode(appId1, "order-service", "team-commerce");
		DependencyNode node2 = new DependencyNode(appId2, "payment-service", "team-payments");
		DependencyEdge edge = new DependencyEdge("order-service", "1.0.0", "payment-service", "2.0.0", "SUCCESS",
				Instant.parse("2026-01-15T10:30:00Z"));
		given(this.dependencyGraphService.getGraph(null))
			.willReturn(new DependencyGraphResponse(List.of(node1, node2), List.of(edge), List.of()));

		// when/then
		this.mockMvc.perform(get("/api/v1/graph"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.nodes", hasSize(2)))
			.andExpect(jsonPath("$.nodes[0].applicationName").value("order-service"))
			.andExpect(jsonPath("$.edges", hasSize(1)))
			.andExpect(jsonPath("$.edges[0].providerName").value("order-service"))
			.andExpect(jsonPath("$.edges[0].consumerName").value("payment-service"))
			.andExpect(jsonPath("$.edges[0].status").value("SUCCESS"));
	}

	@Test
	void should_return_empty_graph_when_no_verifications() throws Exception {
		// given
		given(this.dependencyGraphService.getGraph(null))
			.willReturn(new DependencyGraphResponse(List.of(), List.of(), List.of()));

		// when/then
		this.mockMvc.perform(get("/api/v1/graph"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.nodes", hasSize(0)))
			.andExpect(jsonPath("$.edges", hasSize(0)));
	}

	@Test
	void should_filter_graph_by_environment() throws Exception {
		// given
		UUID appId = UUID.randomUUID();
		DependencyNode node = new DependencyNode(appId, "order-service", "team-commerce");
		given(this.dependencyGraphService.getGraph("production"))
			.willReturn(new DependencyGraphResponse(List.of(node), List.of(), List.of()));

		// when/then
		this.mockMvc.perform(get("/api/v1/graph").param("environment", "production"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.nodes", hasSize(1)))
			.andExpect(jsonPath("$.nodes[0].applicationName").value("order-service"));
	}

	@Test
	void should_return_application_dependencies() throws Exception {
		// given
		DependencyEdge provider = new DependencyEdge("payment-service", "1.0.0", "order-service", "2.0.0", "SUCCESS",
				Instant.parse("2026-01-15T10:30:00Z"));
		DependencyEdge consumer = new DependencyEdge("order-service", "2.0.0", "frontend", "3.0.0", "SUCCESS",
				Instant.parse("2026-01-16T10:30:00Z"));
		given(this.dependencyGraphService.getApplicationDependencies("order-service"))
			.willReturn(new ApplicationDependenciesResponse("order-service", List.of(provider), List.of(consumer)));

		// when/then
		this.mockMvc.perform(get("/api/v1/graph/applications/order-service"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.applicationName").value("order-service"))
			.andExpect(jsonPath("$.providers", hasSize(1)))
			.andExpect(jsonPath("$.providers[0].providerName").value("payment-service"))
			.andExpect(jsonPath("$.consumers", hasSize(1)))
			.andExpect(jsonPath("$.consumers[0].consumerName").value("frontend"));
	}

	@Test
	void should_return_404_when_application_not_found() throws Exception {
		// given
		given(this.dependencyGraphService.getApplicationDependencies("nonexistent"))
			.willThrow(new ApplicationNotFoundException("nonexistent"));

		// when/then
		this.mockMvc.perform(get("/api/v1/graph/applications/nonexistent"))
			.andExpect(status().isNotFound())
			.andExpect(jsonPath("$.code").value("APPLICATION_NOT_FOUND"));
	}

}
