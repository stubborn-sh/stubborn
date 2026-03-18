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
package org.springframework.cloud.contract.broker.contract;

import java.util.List;
import java.util.Map;
import java.util.Objects;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.cloud.contract.broker.TestcontainersConfiguration;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.client.RestClient;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Import(TestcontainersConfiguration.class)
class ContractPublishingE2ETest {

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
	void should_publish_and_retrieve_contract() {
		// given — register application
		registerApplication("e2e-contract-app");

		var contractRequest = Map.of("contractName", "create-order", "content", "request:\n  method: POST",
				"contentType", "application/x-spring-cloud-contract+yaml");

		// when — publish contract
		ResponseEntity<Map> createResponse = this.restClient.post()
			.uri("/api/v1/applications/e2e-contract-app/versions/1.0.0/contracts")
			.contentType(MediaType.APPLICATION_JSON)
			.body(contractRequest)
			.retrieve()
			.toEntity(Map.class);

		// then
		assertThat(createResponse.getStatusCode()).isEqualTo(HttpStatus.CREATED);
		assertThat(Objects.requireNonNull(createResponse.getHeaders().getLocation()).getPath())
			.isEqualTo("/api/v1/applications/e2e-contract-app/versions/1.0.0/contracts/create-order");

		// when — retrieve by name
		ResponseEntity<Map> getResponse = this.restClient.get()
			.uri("/api/v1/applications/e2e-contract-app/versions/1.0.0/contracts/create-order")
			.retrieve()
			.toEntity(Map.class);

		// then
		assertThat(getResponse.getStatusCode()).isEqualTo(HttpStatus.OK);
		assertThat(getResponse.getBody()).containsEntry("contractName", "create-order");
		assertThat(getResponse.getBody()).containsEntry("content", "request:\n  method: POST");
	}

	@Test
	@SuppressWarnings("rawtypes")
	void should_list_contracts_for_version() {
		// given
		registerApplication("e2e-list-contracts-app");

		publishContract("e2e-list-contracts-app", "1.0.0", "create-order", "create content");
		publishContract("e2e-list-contracts-app", "1.0.0", "get-order", "get content");

		// when
		ResponseEntity<Map> response = this.restClient.get()
			.uri("/api/v1/applications/e2e-list-contracts-app/versions/1.0.0/contracts")
			.retrieve()
			.toEntity(Map.class);

		// then
		assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
		assertThat((List<?>) Objects.requireNonNull(response.getBody()).get("content")).hasSize(2);
	}

	@Test
	@SuppressWarnings("rawtypes")
	void should_return_409_for_duplicate_contract() {
		// given
		registerApplication("e2e-dup-contract-app");
		publishContract("e2e-dup-contract-app", "1.0.0", "create-order", "content");

		// when — publish same contract name again
		var duplicateRequest = Map.of("contractName", "create-order", "content", "different content", "contentType",
				"yaml");
		ResponseEntity<Map> response = this.restClient.post()
			.uri("/api/v1/applications/e2e-dup-contract-app/versions/1.0.0/contracts")
			.contentType(MediaType.APPLICATION_JSON)
			.body(duplicateRequest)
			.retrieve()
			.toEntity(Map.class);

		// then
		assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
		assertThat(response.getBody()).containsEntry("code", "CONTRACT_ALREADY_EXISTS");
	}

	@Test
	@SuppressWarnings("rawtypes")
	void should_return_404_when_application_not_found() {
		// when
		var request = Map.of("contractName", "test", "content", "content", "contentType", "yaml");
		ResponseEntity<Map> response = this.restClient.post()
			.uri("/api/v1/applications/e2e-nonexistent/versions/1.0.0/contracts")
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
	void should_return_404_when_contract_not_found() {
		// given
		registerApplication("e2e-contract-404-app");

		// when
		ResponseEntity<Map> response = this.restClient.get()
			.uri("/api/v1/applications/e2e-contract-404-app/versions/1.0.0/contracts/nonexistent")
			.retrieve()
			.toEntity(Map.class);

		// then
		assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
		assertThat(response.getBody()).containsEntry("code", "CONTRACT_NOT_FOUND");
	}

	@Test
	void should_delete_contract() {
		// given
		registerApplication("e2e-delete-contract-app");
		publishContract("e2e-delete-contract-app", "1.0.0", "to-delete", "content");

		// when
		ResponseEntity<Void> deleteResponse = this.restClient.delete()
			.uri("/api/v1/applications/e2e-delete-contract-app/versions/1.0.0/contracts/to-delete")
			.retrieve()
			.toBodilessEntity();

		// then
		assertThat(deleteResponse.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);

		// verify deleted
		@SuppressWarnings("rawtypes")
		ResponseEntity<Map> getResponse = this.restClient.get()
			.uri("/api/v1/applications/e2e-delete-contract-app/versions/1.0.0/contracts/to-delete")
			.retrieve()
			.toEntity(Map.class);
		assertThat(getResponse.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
	}

	private void registerApplication(String name) {
		this.restClient.post()
			.uri("/api/v1/applications")
			.contentType(MediaType.APPLICATION_JSON)
			.body(Map.of("name", name, "description", "E2E test app", "owner", "team"))
			.retrieve()
			.toEntity(Map.class);
	}

	private void publishContract(String appName, String version, String contractName, String content) {
		this.restClient.post()
			.uri("/api/v1/applications/" + appName + "/versions/" + version + "/contracts")
			.contentType(MediaType.APPLICATION_JSON)
			.body(Map.of("contractName", contractName, "content", content, "contentType", "yaml"))
			.retrieve()
			.toEntity(Map.class);
	}

}
