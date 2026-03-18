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
package org.springframework.cloud.contract.broker.graph;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.micrometer.tracing.test.autoconfigure.AutoConfigureTracing;
import org.springframework.boot.restdocs.test.autoconfigure.AutoConfigureRestDocs;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.restdocs.mockmvc.RestDocumentationResultHandler;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.BDDMockito.given;
import static org.springframework.cloud.contract.wiremock.restdocs.SpringCloudContractRestDocs.dslContract;
import static org.springframework.restdocs.mockmvc.MockMvcRestDocumentation.document;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@Tag("generate-stubs")
@WebMvcTest(DependencyGraphController.class)
@AutoConfigureTracing
@AutoConfigureRestDocs
@WithMockUser(roles = "READER")
class DependencyGraphContractTest {

	@Autowired
	MockMvc mockMvc;

	@MockitoBean
	DependencyGraphService dependencyGraphService;

	@Test
	void should_return_full_dependency_graph() throws Exception {
		// given
		UUID providerId = UUID.fromString("11111111-1111-1111-1111-111111111111");
		UUID consumerId = UUID.fromString("22222222-2222-2222-2222-222222222222");
		var response = new DependencyGraphResponse(
				List.of(new DependencyNode(providerId, "order-service", "team-commerce"),
						new DependencyNode(consumerId, "payment-service", "team-payments")),
				List.of(new DependencyEdge("order-service", "1.0.0", "payment-service", "2.0.0", "SUCCESS",
						Instant.parse("2026-01-15T10:00:00Z"))));
		given(this.dependencyGraphService.getGraph(null)).willReturn(response);

		// when/then
		this.mockMvc.perform(get("/api/v1/graph"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.nodes").isArray())
			.andExpect(jsonPath("$.nodes[0].applicationName").value("order-service"))
			.andExpect(jsonPath("$.edges[0].providerName").value("order-service"))
			.andExpect(jsonPath("$.edges[0].consumerName").value("payment-service"))
			.andDo(contractDocument("get-dependency-graph"));
	}

	@Test
	void should_return_application_dependencies() throws Exception {
		// given
		var response = new ApplicationDependenciesResponse("payment-service",
				List.of(new DependencyEdge("order-service", "1.0.0", "payment-service", "2.0.0", "SUCCESS",
						Instant.parse("2026-01-15T10:00:00Z"))),
				List.of());
		given(this.dependencyGraphService.getApplicationDependencies("payment-service")).willReturn(response);

		// when/then
		this.mockMvc.perform(get("/api/v1/graph/applications/payment-service"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.applicationName").value("payment-service"))
			.andExpect(jsonPath("$.providers[0].providerName").value("order-service"))
			.andExpect(jsonPath("$.consumers").isEmpty())
			.andDo(contractDocument("get-application-dependencies"));
	}

	private static RestDocumentationResultHandler contractDocument(String identifier) {
		return document(identifier, dslContract());
	}

}
