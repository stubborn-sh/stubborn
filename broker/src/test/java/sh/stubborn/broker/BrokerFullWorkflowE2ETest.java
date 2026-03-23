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
package sh.stubborn.broker;

import java.util.Map;
import java.util.Objects;

import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.junit.jupiter.api.TestMethodOrder;

import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.client.RestClient;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Full workflow acceptance test covering the complete broker lifecycle: health check,
 * application registration, contract publishing, verification recording, deployment
 * tracking, and can-i-deploy safety check.
 *
 * Runs under Failsafe (matches *E2ETest.java).
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Import(TestcontainersConfiguration.class)
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class BrokerFullWorkflowE2ETest {

	private static final String APP_NAME = "wf-order-service";

	private static final String CONSUMER_NAME = "wf-payment-service";

	private static final String VERSION = "1.0.0";

	private static final String CONSUMER_VERSION = "2.0.0";

	private static final String ENVIRONMENT = "wf-staging";

	@LocalServerPort
	int port;

	RestClient restClient;

	RestClient publicClient;

	@BeforeAll
	void setUp() {
		this.restClient = RestClient.builder()
			.baseUrl("http://localhost:" + this.port)
			.defaultHeaders(headers -> headers.setBasicAuth("admin", "admin"))
			.defaultStatusHandler(HttpStatusCode::isError, (req, res) -> {
			})
			.build();
		this.publicClient = RestClient.builder()
			.baseUrl("http://localhost:" + this.port)
			.defaultStatusHandler(HttpStatusCode::isError, (req, res) -> {
			})
			.build();
	}

	@Test
	@Order(1)
	@SuppressWarnings("rawtypes")
	void should_return_healthy() {
		// when
		ResponseEntity<Map> response = this.publicClient.get().uri("/actuator/health").retrieve().toEntity(Map.class);

		// then
		assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
		assertThat(Objects.requireNonNull(response.getBody())).containsEntry("status", "UP");
	}

	@Test
	@Order(2)
	@SuppressWarnings("rawtypes")
	void should_register_provider_application() {
		// when
		ResponseEntity<Map> response = this.restClient.post()
			.uri("/api/v1/applications")
			.contentType(MediaType.APPLICATION_JSON)
			.body(Map.of("name", APP_NAME, "description", "Workflow test provider", "owner", "workflow-team"))
			.retrieve()
			.toEntity(Map.class);

		// then
		assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
		assertThat(response.getHeaders().getLocation()).isNotNull();
		assertThat(Objects.requireNonNull(response.getBody())).containsEntry("name", APP_NAME);
	}

	@Test
	@Order(3)
	@SuppressWarnings("rawtypes")
	void should_register_consumer_application() {
		// when
		ResponseEntity<Map> response = this.restClient.post()
			.uri("/api/v1/applications")
			.contentType(MediaType.APPLICATION_JSON)
			.body(Map.of("name", CONSUMER_NAME, "description", "Workflow test consumer", "owner", "workflow-team"))
			.retrieve()
			.toEntity(Map.class);

		// then
		assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
		assertThat(Objects.requireNonNull(response.getBody())).containsEntry("name", CONSUMER_NAME);
	}

	@Test
	@Order(4)
	@SuppressWarnings("rawtypes")
	void should_publish_contract() {
		// when
		ResponseEntity<Map> response = this.restClient.post()
			.uri("/api/v1/applications/{app}/versions/{ver}/contracts", APP_NAME, VERSION)
			.contentType(MediaType.APPLICATION_JSON)
			.body(Map.of("contractName", "create-order", "content", "request:\n  method: POST\n  url: /orders",
					"contentType", "application/x-spring-cloud-contract+yaml"))
			.retrieve()
			.toEntity(Map.class);

		// then
		assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
		assertThat(Objects.requireNonNull(response.getBody())).containsEntry("contractName", "create-order");
	}

	@Test
	@Order(5)
	@SuppressWarnings("rawtypes")
	void should_record_verification() {
		// when
		ResponseEntity<Map> response = this.restClient.post()
			.uri("/api/v1/verifications")
			.contentType(MediaType.APPLICATION_JSON)
			.body(Map.of("providerName", APP_NAME, "providerVersion", VERSION, "consumerName", CONSUMER_NAME,
					"consumerVersion", CONSUMER_VERSION, "status", "SUCCESS"))
			.retrieve()
			.toEntity(Map.class);

		// then
		assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
		assertThat(Objects.requireNonNull(response.getBody())).containsEntry("status", "SUCCESS");
	}

	@Test
	@Order(6)
	@SuppressWarnings("rawtypes")
	void should_record_deployment() {
		// when
		ResponseEntity<Map> response = this.restClient.post()
			.uri("/api/v1/environments/{env}/deployments", ENVIRONMENT)
			.contentType(MediaType.APPLICATION_JSON)
			.body(Map.of("applicationName", CONSUMER_NAME, "version", CONSUMER_VERSION))
			.retrieve()
			.toEntity(Map.class);

		// then
		assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
		assertThat(Objects.requireNonNull(response.getBody())).containsEntry("environment", ENVIRONMENT);
	}

	@Test
	@Order(7)
	@SuppressWarnings("rawtypes")
	void should_confirm_safe_to_deploy() {
		// when
		ResponseEntity<Map> response = this.restClient.get()
			.uri("/api/v1/can-i-deploy?application={app}&version={ver}&environment={env}", APP_NAME, VERSION,
					ENVIRONMENT)
			.retrieve()
			.toEntity(Map.class);

		// then
		assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
		assertThat(Objects.requireNonNull(response.getBody())).containsEntry("safe", true);
	}

}
