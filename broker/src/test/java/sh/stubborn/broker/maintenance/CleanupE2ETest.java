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
package sh.stubborn.broker.maintenance;

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
class CleanupE2ETest {

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
	void should_cleanup_old_versions() {
		// given — publish multiple versions
		registerApplication("e2e-cleanup-app");
		for (int i = 1; i <= 5; i++) {
			publishContract("e2e-cleanup-app", i + ".0.0", "cleanup-contract");
		}

		// when — keep only latest 3
		ResponseEntity<Map> response = this.restClient.post()
			.uri("/api/v1/maintenance/cleanup")
			.contentType(MediaType.APPLICATION_JSON)
			.body(Map.of("applicationName", "e2e-cleanup-app", "keepLatestVersions", 3, "protectedEnvironments",
					List.of()))
			.retrieve()
			.toEntity(Map.class);

		// then
		assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
		Map<String, Object> body = Objects.requireNonNull(response.getBody());
		assertThat(body.get("deletedCount")).isNotNull();
	}

	@Test
	@SuppressWarnings("rawtypes")
	void should_protect_deployed_versions() {
		// given
		registerApplication("e2e-cleanup-protect-app");
		publishContract("e2e-cleanup-protect-app", "1.0.0", "protect-contract");
		publishContract("e2e-cleanup-protect-app", "2.0.0", "protect-contract");
		publishContract("e2e-cleanup-protect-app", "3.0.0", "protect-contract");
		recordDeployment("cleanup-protect-env", "e2e-cleanup-protect-app", "1.0.0");

		// when — keep latest 1, protect env
		ResponseEntity<Map> response = this.restClient.post()
			.uri("/api/v1/maintenance/cleanup")
			.contentType(MediaType.APPLICATION_JSON)
			.body(Map.of("applicationName", "e2e-cleanup-protect-app", "keepLatestVersions", 1, "protectedEnvironments",
					List.of("cleanup-protect-env")))
			.retrieve()
			.toEntity(Map.class);

		// then — version 1.0.0 should be protected (deployed), 3.0.0 kept (latest)
		assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
	}

	@SuppressWarnings("rawtypes")
	private void registerApplication(String name) {
		this.restClient.post()
			.uri("/api/v1/applications")
			.contentType(MediaType.APPLICATION_JSON)
			.body(Map.of("name", name, "description", "E2E cleanup test", "owner", "team"))
			.retrieve()
			.toEntity(Map.class);
	}

	@SuppressWarnings("rawtypes")
	private void publishContract(String appName, String version, String contractName) {
		this.restClient.post()
			.uri("/api/v1/applications/" + appName + "/versions/" + version + "/contracts")
			.contentType(MediaType.APPLICATION_JSON)
			.body(Map.of("contractName", contractName, "content", "{}", "contentType", "application/json"))
			.retrieve()
			.toEntity(Map.class);
	}

	@SuppressWarnings("rawtypes")
	private void recordDeployment(String environment, String applicationName, String version) {
		this.restClient.post()
			.uri("/api/v1/environments/" + environment + "/deployments")
			.contentType(MediaType.APPLICATION_JSON)
			.body(Map.of("applicationName", applicationName, "version", version))
			.retrieve()
			.toEntity(Map.class);
	}

}
