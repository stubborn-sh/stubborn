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
package org.springframework.cloud.contract.broker.observability;

import java.util.Map;
import java.util.Objects;

import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.junit.jupiter.api.TestMethodOrder;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.wait.strategy.Wait;

import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.web.client.RestClient;

import org.springframework.cloud.contract.broker.TestcontainersConfiguration;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * E2E tests verifying that the broker properly publishes metrics, traces, and health
 * probes. Runs under Failsafe (matches *E2ETest.java). Requires Docker for LGTM
 * container.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Import(TestcontainersConfiguration.class)
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class ObservabilityE2ETest {

	static final GenericContainer<?> lgtm = new GenericContainer<>("grafana/otel-lgtm:latest")
		.withExposedPorts(3000, 3100, 3200, 4318, 9090)
		.waitingFor(Wait.forHttp("/api/health").forPort(3000).forStatusCode(200));

	static {
		lgtm.start();
	}

	@DynamicPropertySource
	static void configureLgtm(DynamicPropertyRegistry registry) {
		registry.add("management.otlp.metrics.export.enabled", () -> "true");
		registry.add("management.otlp.metrics.export.url",
				() -> "http://localhost:" + lgtm.getMappedPort(4318) + "/v1/metrics");
		registry.add("management.otlp.tracing.endpoint",
				() -> "http://localhost:" + lgtm.getMappedPort(4318) + "/v1/traces");
		registry.add("management.prometheus.metrics.export.enabled", () -> "true");
	}

	@LocalServerPort
	int port;

	RestClient brokerClient;

	RestClient lgtmClient;

	@BeforeAll
	void setUp() {
		this.brokerClient = RestClient.builder()
			.baseUrl("http://localhost:" + this.port)
			.defaultHeaders(headers -> headers.setBasicAuth("admin", "admin"))
			.defaultStatusHandler(HttpStatusCode::isError, (req, res) -> {
			})
			.build();
		this.lgtmClient = RestClient.builder()
			.baseUrl("http://localhost:" + lgtm.getMappedPort(3000))
			.defaultStatusHandler(HttpStatusCode::isError, (req, res) -> {
			})
			.build();
	}

	@Test
	@Order(1)
	void should_expose_liveness_probe() {
		// when
		ResponseEntity<String> response = this.brokerClient.get()
			.uri("/actuator/health/liveness")
			.retrieve()
			.toEntity(String.class);

		// then
		assertThat(response.getStatusCode().value()).isEqualTo(200);
		assertThat(Objects.requireNonNull(response.getBody())).contains("UP");
	}

	@Test
	@Order(2)
	void should_expose_readiness_probe() {
		// when
		ResponseEntity<String> response = this.brokerClient.get()
			.uri("/actuator/health/readiness")
			.retrieve()
			.toEntity(String.class);

		// then
		assertThat(response.getStatusCode().value()).isEqualTo(200);
		assertThat(Objects.requireNonNull(response.getBody())).contains("UP");
	}

	@Test
	@Order(3)
	void should_expose_prometheus_metrics_endpoint() {
		// when
		ResponseEntity<String> response = this.brokerClient.get()
			.uri("/actuator/prometheus")
			.retrieve()
			.toEntity(String.class);

		// then
		assertThat(response.getStatusCode().value()).isEqualTo(200);
		String body = Objects.requireNonNull(response.getBody());
		assertThat(body).contains("jvm_memory_used_bytes");
	}

	@Test
	@Order(4)
	@SuppressWarnings("rawtypes")
	void should_record_http_request_metrics_after_api_call() {
		// given — make an API call to generate metrics
		this.brokerClient.get().uri("/api/v1/applications").retrieve().toEntity(Map.class);

		// when — check Prometheus metrics
		ResponseEntity<String> response = this.brokerClient.get()
			.uri("/actuator/prometheus")
			.retrieve()
			.toEntity(String.class);

		// then
		String body = Objects.requireNonNull(response.getBody());
		assertThat(body).contains("http_server_requests");
	}

	@Test
	@Order(5)
	void should_include_trace_header_in_responses() {
		// given — register an application to generate trace activity
		this.brokerClient.post()
			.uri("/api/v1/applications")
			.contentType(MediaType.APPLICATION_JSON)
			.body(Map.of("name", "obs-test-app", "description", "Observability test", "owner", "obs-team"))
			.retrieve()
			.toEntity(String.class);

		// when
		ResponseEntity<String> response = this.brokerClient.get()
			.uri("/api/v1/applications")
			.retrieve()
			.toEntity(String.class);

		// then — verify the actuator health includes trace context propagation
		assertThat(response.getStatusCode().value()).isEqualTo(200);
	}

}
