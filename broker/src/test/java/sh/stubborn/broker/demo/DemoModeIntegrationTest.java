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
package sh.stubborn.broker.demo;

import java.util.List;
import java.util.Map;
import java.util.Objects;

import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;

import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.web.client.RestClient;

import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Integration test verifying that the demo profile activates read-only mode and loads
 * seed data.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Testcontainers
@ActiveProfiles("demo")
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class DemoModeIntegrationTest {

	@Container
	static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine")
		.withDatabaseName("broker")
		.withUsername("broker")
		.withPassword("broker");

	@DynamicPropertySource
	static void configureProperties(DynamicPropertyRegistry registry) {
		registry.add("spring.datasource.url", postgres::getJdbcUrl);
		registry.add("spring.datasource.username", postgres::getUsername);
		registry.add("spring.datasource.password", postgres::getPassword);
	}

	@LocalServerPort
	int port;

	RestClient restClient;

	@BeforeAll
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
	void get_applications_returns_seeded_data() {
		ResponseEntity<Map> response = this.restClient.get().uri("/api/v1/applications").retrieve().toEntity(Map.class);

		assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
		Map<String, Object> body = Objects.requireNonNull(response.getBody());
		// Paginated response: content holds the list of applications
		List<Object> content = (List<Object>) body.get("content");
		assertThat(content).hasSize(6);
	}

	@Test
	@SuppressWarnings("rawtypes")
	void post_applications_blocked_in_demo_mode() {
		ResponseEntity<Map> response = this.restClient.post()
			.uri("/api/v1/applications")
			.contentType(MediaType.APPLICATION_JSON)
			.body(Map.of("name", "blocked-app", "description", "Should not be created", "owner", "team-test"))
			.retrieve()
			.toEntity(Map.class);

		assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
		assertThat(response.getBody()).containsEntry("code", "DEMO_READ_ONLY");
	}

	@Test
	@SuppressWarnings("rawtypes")
	void delete_application_blocked_in_demo_mode() {
		ResponseEntity<Map> response = this.restClient.delete()
			.uri("/api/v1/applications/order-service")
			.retrieve()
			.toEntity(Map.class);

		assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
		assertThat(response.getBody()).containsEntry("code", "DEMO_READ_ONLY");
	}

	@Test
	@SuppressWarnings("rawtypes")
	void post_verifications_blocked_in_demo_mode() {
		ResponseEntity<Map> response = this.restClient.post()
			.uri("/api/v1/verifications")
			.contentType(MediaType.APPLICATION_JSON)
			.body(Map.of("providerName", "order-service", "providerVersion", "1.2.0", "consumerName", "payment-service",
					"consumerVersion", "2.1.0", "status", "SUCCESS"))
			.retrieve()
			.toEntity(Map.class);

		assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
		assertThat(response.getBody()).containsEntry("code", "DEMO_READ_ONLY");
	}

	@Test
	@SuppressWarnings("rawtypes")
	void can_i_deploy_returns_200() {
		ResponseEntity<Map> response = this.restClient.get()
			.uri("/api/v1/can-i-deploy?application={app}&version={ver}&environment={env}", "order-service", "1.2.0",
					"production")
			.retrieve()
			.toEntity(Map.class);

		assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
	}

	@Test
	@SuppressWarnings("rawtypes")
	void graph_endpoint_returns_200() {
		ResponseEntity<Map> response = this.restClient.get().uri("/api/v1/graph").retrieve().toEntity(Map.class);

		assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
	}

}
