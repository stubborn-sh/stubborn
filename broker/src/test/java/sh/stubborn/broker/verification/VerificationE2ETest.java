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
package sh.stubborn.broker.verification;

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
class VerificationE2ETest {

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
	@SuppressWarnings("rawtypes")
	void should_record_and_retrieve_verification() {
		// given
		registerApplication("e2e-verify-provider");
		registerApplication("e2e-verify-consumer");

		var request = Map.of("providerName", "e2e-verify-provider", "providerVersion", "1.0.0", "consumerName",
				"e2e-verify-consumer", "consumerVersion", "2.0.0", "status", "SUCCESS");

		// when — record
		ResponseEntity<Map> createResponse = this.restClient.post()
			.uri("/api/v1/verifications")
			.contentType(MediaType.APPLICATION_JSON)
			.body(request)
			.retrieve()
			.toEntity(Map.class);

		// then
		assertThat(createResponse.getStatusCode()).isEqualTo(HttpStatus.CREATED);
		assertThat(createResponse.getHeaders().getLocation()).isNotNull();

		// when — list by provider
		ResponseEntity<Map> listResponse = this.restClient.get()
			.uri("/api/v1/verifications?provider=e2e-verify-provider&providerVersion=1.0.0")
			.retrieve()
			.toEntity(Map.class);

		// then
		assertThat(listResponse.getStatusCode()).isEqualTo(HttpStatus.OK);
		assertThat((List<?>) Objects.requireNonNull(listResponse.getBody()).get("content")).hasSize(1);
	}

	@Test
	@SuppressWarnings("rawtypes")
	void should_return_409_for_duplicate_verification() {
		// given
		registerApplication("e2e-dup-verify-provider");
		registerApplication("e2e-dup-verify-consumer");

		var request = Map.of("providerName", "e2e-dup-verify-provider", "providerVersion", "1.0.0", "consumerName",
				"e2e-dup-verify-consumer", "consumerVersion", "2.0.0", "status", "SUCCESS");

		this.restClient.post()
			.uri("/api/v1/verifications")
			.contentType(MediaType.APPLICATION_JSON)
			.body(request)
			.retrieve()
			.toEntity(Map.class);

		// when — duplicate
		ResponseEntity<Map> response = this.restClient.post()
			.uri("/api/v1/verifications")
			.contentType(MediaType.APPLICATION_JSON)
			.body(request)
			.retrieve()
			.toEntity(Map.class);

		// then
		assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
		assertThat(response.getBody()).containsEntry("code", "VERIFICATION_ALREADY_EXISTS");
	}

	@Test
	@SuppressWarnings("rawtypes")
	void should_return_404_when_provider_not_found() {
		// given
		registerApplication("e2e-verify-consumer-only");

		var request = Map.of("providerName", "e2e-nonexistent-provider", "providerVersion", "1.0.0", "consumerName",
				"e2e-verify-consumer-only", "consumerVersion", "1.0.0", "status", "SUCCESS");

		// when
		ResponseEntity<Map> response = this.restClient.post()
			.uri("/api/v1/verifications")
			.contentType(MediaType.APPLICATION_JSON)
			.body(request)
			.retrieve()
			.toEntity(Map.class);

		// then
		assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
		assertThat(response.getBody()).containsEntry("code", "APPLICATION_NOT_FOUND");
	}

	@Test
	@SuppressWarnings("rawtypes")
	void should_record_failed_verification_with_details() {
		// given
		registerApplication("e2e-fail-provider");
		registerApplication("e2e-fail-consumer");

		var request = Map.of("providerName", "e2e-fail-provider", "providerVersion", "1.0.0", "consumerName",
				"e2e-fail-consumer", "consumerVersion", "1.0.0", "status", "FAILED", "details",
				"Contract mismatch on field 'amount'");

		// when
		ResponseEntity<Map> response = this.restClient.post()
			.uri("/api/v1/verifications")
			.contentType(MediaType.APPLICATION_JSON)
			.body(request)
			.retrieve()
			.toEntity(Map.class);

		// then
		assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
		assertThat(response.getBody()).containsEntry("status", "FAILED");
		assertThat(response.getBody()).containsEntry("details", "Contract mismatch on field 'amount'");
	}

	private void registerApplication(String name) {
		this.restClient.post()
			.uri("/api/v1/applications")
			.contentType(MediaType.APPLICATION_JSON)
			.body(Map.of("name", name, "description", "E2E test app", "owner", "team"))
			.retrieve()
			.toEntity(Map.class);
	}

}
