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
package sh.stubborn.broker.matrix;

import java.util.List;
import java.util.Map;
import java.util.Objects;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import sh.stubborn.broker.TestcontainersConfiguration;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.client.RestClient;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Import(TestcontainersConfiguration.class)
class MatrixE2ETest {

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
	void should_return_matrix_with_verifications() {
		// given
		registerApplication("e2e-matrix-provider");
		registerApplication("e2e-matrix-consumer");
		recordVerification("e2e-matrix-provider", "1.0.0", "e2e-matrix-consumer", "2.0.0", "SUCCESS");

		// when
		ResponseEntity<List> response = this.restClient.get().uri("/api/v1/matrix").retrieve().toEntity(List.class);

		// then
		assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
		List<Map<String, Object>> entries = Objects.requireNonNull(response.getBody());
		assertThat(entries).anyMatch(e -> "e2e-matrix-provider".equals(e.get("providerName"))
				&& "e2e-matrix-consumer".equals(e.get("consumerName")));
	}

	@Test
	@SuppressWarnings({ "rawtypes", "unchecked" })
	void should_filter_matrix_by_provider() {
		// given
		registerApplication("e2e-matrix-filter-prov");
		registerApplication("e2e-matrix-filter-cons");
		recordVerification("e2e-matrix-filter-prov", "1.0.0", "e2e-matrix-filter-cons", "1.0.0", "FAILED");

		// when
		ResponseEntity<List> response = this.restClient.get()
			.uri("/api/v1/matrix?provider=e2e-matrix-filter-prov")
			.retrieve()
			.toEntity(List.class);

		// then
		assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
		List<Map<String, Object>> entries = Objects.requireNonNull(response.getBody());
		assertThat(entries).allMatch(e -> "e2e-matrix-filter-prov".equals(e.get("providerName")));
	}

	@SuppressWarnings("rawtypes")
	private void registerApplication(String name) {
		this.restClient.post()
			.uri("/api/v1/applications")
			.contentType(MediaType.APPLICATION_JSON)
			.body(Map.of("name", name, "description", "E2E matrix test", "owner", "team"))
			.retrieve()
			.toEntity(Map.class);
	}

	@SuppressWarnings("rawtypes")
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

}
