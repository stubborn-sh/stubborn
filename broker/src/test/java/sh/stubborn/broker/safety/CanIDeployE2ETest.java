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
package sh.stubborn.broker.safety;

import java.util.Map;

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
class CanIDeployE2ETest {

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
	void should_return_safe_when_all_consumers_verified() {
		// given — full flow: register -> verify -> deploy -> can-i-deploy
		registerApplication("e2e-cid-provider");
		registerApplication("e2e-cid-consumer");

		// verify consumer against provider version
		recordVerification("e2e-cid-provider", "1.0.0", "e2e-cid-consumer", "2.0.0", "SUCCESS");

		// deploy consumer to cid-safe-env
		recordDeployment("cid-safe-env", "e2e-cid-consumer", "2.0.0");

		// when — can-i-deploy
		ResponseEntity<Map> response = this.restClient.get()
			.uri("/api/v1/can-i-deploy?application=e2e-cid-provider&version=1.0.0&environment=cid-safe-env")
			.retrieve()
			.toEntity(Map.class);

		// then
		assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
		assertThat(response.getBody()).containsEntry("safe", true);
		assertThat(response.getBody()).containsEntry("application", "e2e-cid-provider");
	}

	@Test
	@SuppressWarnings("rawtypes")
	void should_return_unsafe_when_consumer_not_verified() {
		// given — deploy consumer but no verification
		registerApplication("e2e-cid-unsafe-provider");
		registerApplication("e2e-cid-unsafe-consumer");

		recordDeployment("cid-unsafe-env", "e2e-cid-unsafe-consumer", "1.0.0");

		// when
		ResponseEntity<Map> response = this.restClient.get()
			.uri("/api/v1/can-i-deploy?application=e2e-cid-unsafe-provider&version=1.0.0&environment=cid-unsafe-env")
			.retrieve()
			.toEntity(Map.class);

		// then
		assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
		assertThat(response.getBody()).containsEntry("safe", false);
	}

	@Test
	@SuppressWarnings("rawtypes")
	void should_return_safe_when_no_consumers_in_environment() {
		// given
		registerApplication("e2e-cid-lonely");

		// when — environment with no deployments
		ResponseEntity<Map> response = this.restClient.get()
			.uri("/api/v1/can-i-deploy?application=e2e-cid-lonely&version=1.0.0&environment=empty-env")
			.retrieve()
			.toEntity(Map.class);

		// then
		assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
		assertThat(response.getBody()).containsEntry("safe", true);
	}

	@Test
	@SuppressWarnings("rawtypes")
	void should_return_404_when_application_not_found() {
		// when
		ResponseEntity<Map> response = this.restClient.get()
			.uri("/api/v1/can-i-deploy?application=e2e-cid-nonexistent&version=1.0.0&environment=cid-any-env")
			.retrieve()
			.toEntity(Map.class);

		// then
		assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
	}

	@Test
	@SuppressWarnings("rawtypes")
	void should_return_unsafe_when_verification_failed() {
		// given — verification exists but FAILED
		registerApplication("e2e-cid-fail-provider");
		registerApplication("e2e-cid-fail-consumer");

		recordVerification("e2e-cid-fail-provider", "1.0.0", "e2e-cid-fail-consumer", "1.0.0", "FAILED");
		recordDeployment("cid-fail-env", "e2e-cid-fail-consumer", "1.0.0");

		// when
		ResponseEntity<Map> response = this.restClient.get()
			.uri("/api/v1/can-i-deploy?application=e2e-cid-fail-provider&version=1.0.0&environment=cid-fail-env")
			.retrieve()
			.toEntity(Map.class);

		// then
		assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
		assertThat(response.getBody()).containsEntry("safe", false);
	}

	private void registerApplication(String name) {
		this.restClient.post()
			.uri("/api/v1/applications")
			.contentType(MediaType.APPLICATION_JSON)
			.body(Map.of("name", name, "description", "E2E test app", "owner", "team"))
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
