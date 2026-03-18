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

import java.util.List;
import java.util.Map;
import java.util.Objects;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.cloud.contract.broker.TestcontainersConfiguration;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.client.RestClient;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Import(TestcontainersConfiguration.class)
class DependencyGraphE2ETest {

	@LocalServerPort
	int port;

	RestClient restClient;

	@BeforeEach
	void setUp() {
		this.restClient = RestClient.builder()
			.baseUrl("http://localhost:" + this.port)
			.defaultHeaders(headers -> headers.setBasicAuth("admin", "admin"))
			.defaultStatusHandler(HttpStatusCode::isError, (req, res) -> {
			})
			.build();
	}

	@Test
	@SuppressWarnings({ "rawtypes", "unchecked" })
	void should_return_dependency_graph_with_verifications() {
		// given — register apps and record verification
		registerApplication("e2e-graph-provider");
		registerApplication("e2e-graph-consumer");
		recordVerification("e2e-graph-provider", "1.0.0", "e2e-graph-consumer", "2.0.0", "SUCCESS");

		// when
		ResponseEntity<Map> response = this.restClient.get().uri("/api/v1/graph").retrieve().toEntity(Map.class);

		// then
		assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
		Map<String, Object> body = Objects.requireNonNull(response.getBody());
		List<Map<String, Object>> edges = (List<Map<String, Object>>) body.get("edges");
		assertThat(edges).isNotEmpty();
		assertThat(edges).anyMatch(edge -> "e2e-graph-provider".equals(edge.get("providerName"))
				&& "e2e-graph-consumer".equals(edge.get("consumerName")));
	}

	@Test
	@SuppressWarnings({ "rawtypes", "unchecked" })
	void should_return_application_dependencies() {
		// given
		registerApplication("e2e-graph-dep-provider");
		registerApplication("e2e-graph-dep-consumer");
		recordVerification("e2e-graph-dep-provider", "1.0.0", "e2e-graph-dep-consumer", "1.0.0", "SUCCESS");

		// when
		ResponseEntity<Map> response = this.restClient.get()
			.uri("/api/v1/graph/applications/e2e-graph-dep-consumer")
			.retrieve()
			.toEntity(Map.class);

		// then
		assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
		Map<String, Object> body = Objects.requireNonNull(response.getBody());
		assertThat(body.get("applicationName")).isEqualTo("e2e-graph-dep-consumer");
		List<Map<String, Object>> providers = (List<Map<String, Object>>) Objects.requireNonNull(body.get("providers"));
		assertThat(providers).hasSize(1);
		assertThat(providers.get(0).get("providerName")).isEqualTo("e2e-graph-dep-provider");
	}

	@Test
	@SuppressWarnings({ "rawtypes", "unchecked" })
	void should_filter_graph_by_environment() {
		// given
		registerApplication("e2e-graph-env-provider");
		registerApplication("e2e-graph-env-consumer");
		recordVerification("e2e-graph-env-provider", "1.0.0", "e2e-graph-env-consumer", "1.0.0", "SUCCESS");
		recordVerification("e2e-graph-env-provider", "2.0.0", "e2e-graph-env-consumer", "1.0.0", "SUCCESS");
		recordDeployment("graph-test-env", "e2e-graph-env-provider", "1.0.0");
		recordDeployment("graph-test-env", "e2e-graph-env-consumer", "1.0.0");

		// when — filter by environment
		ResponseEntity<Map> response = this.restClient.get()
			.uri("/api/v1/graph?environment=graph-test-env")
			.retrieve()
			.toEntity(Map.class);

		// then — only v1.0.0 edge should match
		assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
		Map<String, Object> body = Objects.requireNonNull(response.getBody());
		List<Map<String, Object>> edges = (List<Map<String, Object>>) Objects.requireNonNull(body.get("edges"));
		List<Map<String, Object>> graphEdges = edges.stream()
			.filter(e -> "e2e-graph-env-provider".equals(e.get("providerName")))
			.toList();
		assertThat(graphEdges).hasSize(1);
		assertThat(graphEdges.get(0).get("providerVersion")).isEqualTo("1.0.0");
	}

	@Test
	@SuppressWarnings("rawtypes")
	void should_return_404_for_unknown_application_dependencies() {
		// when
		ResponseEntity<Map> response = this.restClient.get()
			.uri("/api/v1/graph/applications/e2e-nonexistent-app")
			.retrieve()
			.toEntity(Map.class);

		// then
		assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
	}

	private void registerApplication(String name) {
		this.restClient.post()
			.uri("/api/v1/applications")
			.contentType(MediaType.APPLICATION_JSON)
			.body(Map.of("name", name, "description", "E2E graph test app", "owner", "team"))
			.retrieve()
			.toEntity(Map.class);
	}

	private void recordVerification(String providerName, String providerVersion, String consumerName,
			String consumerVersion, String status) {
		this.restClient.post()
			.uri("/api/v1/verifications")
			.contentType(MediaType.APPLICATION_JSON)
			.body(Map.of("providerName", providerName, "providerVersion", providerVersion, "consumerName", consumerName,
					"consumerVersion", consumerVersion, "status", status))
			.retrieve()
			.toEntity(Map.class);
	}

	private void recordDeployment(String environment, String applicationName, String version) {
		this.restClient.post()
			.uri("/api/v1/environments/" + environment + "/deployments")
			.contentType(MediaType.APPLICATION_JSON)
			.body(Map.of("applicationName", applicationName, "version", version))
			.retrieve()
			.toEntity(Map.class);
	}

}
