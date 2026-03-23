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
package sh.stubborn.broker.environment;

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
class DeploymentE2ETest {

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
	void should_record_and_retrieve_deployment() {
		// given
		registerApplication("e2e-deploy-app");

		var request = Map.of("applicationName", "e2e-deploy-app", "version", "1.0.0");

		// when — record deployment
		ResponseEntity<Map> createResponse = this.restClient.post()
			.uri("/api/v1/environments/staging/deployments")
			.contentType(MediaType.APPLICATION_JSON)
			.body(request)
			.retrieve()
			.toEntity(Map.class);

		// then
		assertThat(createResponse.getStatusCode()).isEqualTo(HttpStatus.CREATED);
		assertThat(createResponse.getHeaders().getLocation()).isNotNull();
		assertThat(createResponse.getBody()).containsEntry("environment", "staging");
		assertThat(createResponse.getBody()).containsEntry("version", "1.0.0");

		// when — get by application
		ResponseEntity<Map> getResponse = this.restClient.get()
			.uri("/api/v1/environments/staging/deployments/e2e-deploy-app")
			.retrieve()
			.toEntity(Map.class);

		// then
		assertThat(getResponse.getStatusCode()).isEqualTo(HttpStatus.OK);
		assertThat(getResponse.getBody()).containsEntry("version", "1.0.0");
	}

	@Test
	@SuppressWarnings("rawtypes")
	void should_update_deployment_version_on_redeploy() {
		// given
		registerApplication("e2e-redeploy-app");

		this.restClient.post()
			.uri("/api/v1/environments/production/deployments")
			.contentType(MediaType.APPLICATION_JSON)
			.body(Map.of("applicationName", "e2e-redeploy-app", "version", "1.0.0"))
			.retrieve()
			.toEntity(Map.class);

		// when — redeploy with new version
		ResponseEntity<Map> updateResponse = this.restClient.post()
			.uri("/api/v1/environments/production/deployments")
			.contentType(MediaType.APPLICATION_JSON)
			.body(Map.of("applicationName", "e2e-redeploy-app", "version", "2.0.0"))
			.retrieve()
			.toEntity(Map.class);

		// then
		assertThat(updateResponse.getStatusCode()).isEqualTo(HttpStatus.CREATED);
		assertThat(updateResponse.getBody()).containsEntry("version", "2.0.0");

		// verify — get returns updated version
		ResponseEntity<Map> getResponse = this.restClient.get()
			.uri("/api/v1/environments/production/deployments/e2e-redeploy-app")
			.retrieve()
			.toEntity(Map.class);
		assertThat(getResponse.getBody()).containsEntry("version", "2.0.0");
	}

	@Test
	@SuppressWarnings("rawtypes")
	void should_list_deployments_by_environment() {
		// given
		registerApplication("e2e-list-deploy-app");

		this.restClient.post()
			.uri("/api/v1/environments/qa/deployments")
			.contentType(MediaType.APPLICATION_JSON)
			.body(Map.of("applicationName", "e2e-list-deploy-app", "version", "1.0.0"))
			.retrieve()
			.toEntity(Map.class);

		// when
		ResponseEntity<Map> listResponse = this.restClient.get()
			.uri("/api/v1/environments/qa/deployments")
			.retrieve()
			.toEntity(Map.class);

		// then
		assertThat(listResponse.getStatusCode()).isEqualTo(HttpStatus.OK);
		assertThat((List<?>) Objects.requireNonNull(listResponse.getBody()).get("content")).isNotEmpty();
	}

	@Test
	@SuppressWarnings("rawtypes")
	void should_return_404_when_deployment_not_found() {
		// given
		registerApplication("e2e-no-deploy-app");

		// when
		ResponseEntity<Map> response = this.restClient.get()
			.uri("/api/v1/environments/staging/deployments/e2e-no-deploy-app")
			.retrieve()
			.toEntity(Map.class);

		// then
		assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
		assertThat(response.getBody()).containsEntry("code", "DEPLOYMENT_NOT_FOUND");
	}

	@Test
	@SuppressWarnings("rawtypes")
	void should_return_404_when_application_not_found() {
		// when
		ResponseEntity<Map> response = this.restClient.post()
			.uri("/api/v1/environments/staging/deployments")
			.contentType(MediaType.APPLICATION_JSON)
			.body(Map.of("applicationName", "e2e-nonexistent-deploy-app", "version", "1.0.0"))
			.retrieve()
			.toEntity(Map.class);

		// then
		assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
		assertThat(response.getBody()).containsEntry("code", "APPLICATION_NOT_FOUND");
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
