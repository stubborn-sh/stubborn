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
package org.example.payment;

import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.junit.jupiter.api.TestMethodOrder;

import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.client.RestClient;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Reports consumer verification result to the broker after contracts have been verified.
 */
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class BrokerUsageReportIT {

	RestClient restClient;

	@BeforeAll
	void setUp() {
		String brokerUrl = System.getProperty("broker.url", "http://localhost:18080");
		this.restClient = RestClient.builder()
			.baseUrl(brokerUrl)
			.defaultHeaders(headers -> headers.setBasicAuth("admin", "admin"))
			.defaultStatusHandler(HttpStatusCode::isError, (req, res) -> {
			})
			.build();
	}

	@Test
	@Order(1)
	@SuppressWarnings("rawtypes")
	void should_report_verification_to_broker() {
		// given — ensure consumer application is registered
		this.restClient.post()
			.uri("/api/v1/applications")
			.contentType(MediaType.APPLICATION_JSON)
			.body(Map.of("name", "payment-service", "description", "Sample Payment Service", "owner", "sample-team"))
			.retrieve()
			.toEntity(Map.class);

		// when
		ResponseEntity<Map> response = this.restClient.post()
			.uri("/api/v1/verifications")
			.contentType(MediaType.APPLICATION_JSON)
			.body(Map.of("providerName", "order-service", "providerVersion", "1.0.0", "consumerName", "payment-service",
					"consumerVersion", "1.0.0", "status", "SUCCESS"))
			.retrieve()
			.toEntity(Map.class);

		// then — 201 on first run, 409 if verification already exists
		assertThat(response.getStatusCode()).isIn(HttpStatus.CREATED, HttpStatus.CONFLICT);
	}

	@Test
	@Order(2)
	@SuppressWarnings({ "rawtypes", "unchecked" })
	void should_show_verification_in_dependency_graph() {
		// given — verification was reported in @Order(1)

		// when
		ResponseEntity<Map> response = this.restClient.get().uri("/api/v1/graph").retrieve().toEntity(Map.class);

		// then
		assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
		Map<String, Object> body = response.getBody();
		assertThat(body).isNotNull();

		List<Map<String, Object>> edges = (List<Map<String, Object>>) body.get("edges");
		assertThat(edges).isNotEmpty();
		assertThat(edges).anyMatch(edge -> "order-service".equals(edge.get("providerName"))
				&& "payment-service".equals(edge.get("consumerName")));

		List<Map<String, Object>> nodes = (List<Map<String, Object>>) body.get("nodes");
		assertThat(nodes).isNotEmpty();
		assertThat(nodes).anyMatch(node -> "order-service".equals(node.get("applicationName")));
		assertThat(nodes).anyMatch(node -> "payment-service".equals(node.get("applicationName")));
	}

}
