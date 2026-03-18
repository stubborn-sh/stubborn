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
package org.example.order;

import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;

import org.springframework.http.HttpStatusCode;
import org.springframework.http.ResponseEntity;
import org.springframework.web.client.RestClient;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Validates that AI-generated contracts from the proxy are available in the broker. This
 * test is intended for manual execution after proxy traffic has been generated.
 */
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class ProxyContractValidationIT {

	RestClient restClient;

	@BeforeAll
	void setUp() {
		String brokerUrl = System.getProperty("broker.url", "http://localhost:18080");
		this.restClient = RestClient.builder()
			.baseUrl(brokerUrl)
			.defaultHeaders(headers -> headers.setBasicAuth("reader", "reader"))
			.defaultStatusHandler(HttpStatusCode::isError, (req, res) -> {
			})
			.build();
	}

	@Test
	@SuppressWarnings("rawtypes")
	void should_find_contracts_in_broker() {
		// when
		ResponseEntity<List> response = this.restClient.get()
			.uri("/api/v1/applications")
			.retrieve()
			.toEntity(List.class);

		// then
		assertThat(response.getStatusCode().is2xxSuccessful()).isTrue();
		assertThat(response.getBody()).isNotEmpty();
	}

}
