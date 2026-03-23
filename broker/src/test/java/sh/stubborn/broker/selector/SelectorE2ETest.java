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
package sh.stubborn.broker.selector;

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
class SelectorE2ETest {

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
	void should_resolve_selectors_by_main_branch() {
		// given — register app, publish contract on main branch
		registerApplication("e2e-selector-app");
		publishContractOnBranch("e2e-selector-app", "1.0.0", "selector-contract", "main");

		// when — resolve selectors for main branch
		ResponseEntity<List> response = this.restClient.post()
			.uri("/api/v1/selectors/resolve")
			.contentType(MediaType.APPLICATION_JSON)
			.body(Map.of("selectors", List.of(Map.of("mainBranch", true, "deployed", false))))
			.retrieve()
			.toEntity(List.class);

		// then
		assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
		List<Map<String, Object>> resolved = Objects.requireNonNull(response.getBody());
		assertThat(resolved).isNotNull();
	}

	@Test
	@SuppressWarnings({ "rawtypes", "unchecked" })
	void should_resolve_selectors_by_consumer_name() {
		// given
		registerApplication("e2e-selector-consumer");
		publishContract("e2e-selector-consumer", "1.0.0", "consumer-contract");

		// when
		ResponseEntity<List> response = this.restClient.post()
			.uri("/api/v1/selectors/resolve")
			.contentType(MediaType.APPLICATION_JSON)
			.body(Map.of("selectors",
					List.of(Map.of("mainBranch", false, "deployed", false, "consumer", "e2e-selector-consumer"))))
			.retrieve()
			.toEntity(List.class);

		// then
		assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
	}

	@SuppressWarnings("rawtypes")
	private void registerApplication(String name) {
		this.restClient.post()
			.uri("/api/v1/applications")
			.contentType(MediaType.APPLICATION_JSON)
			.body(Map.of("name", name, "description", "E2E selector test", "owner", "team"))
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
	private void publishContractOnBranch(String appName, String version, String contractName, String branch) {
		this.restClient.post()
			.uri("/api/v1/applications/" + appName + "/versions/" + version + "/contracts")
			.contentType(MediaType.APPLICATION_JSON)
			.body(Map.of("contractName", contractName, "content", "{}", "contentType", "application/json", "branch",
					branch))
			.retrieve()
			.toEntity(Map.class);
	}

}
