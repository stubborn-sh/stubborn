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
package sh.stubborn.broker.application;

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
class ApplicationRegistrationE2ETest {

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
	void should_register_and_retrieve_application() {
		// given
		var request = Map.of("name", "e2e-order-service", "description", "E2E test app", "owner", "e2e-team");

		// when — register
		ResponseEntity<Map> createResponse = this.restClient.post()
			.uri("/api/v1/applications")
			.contentType(MediaType.APPLICATION_JSON)
			.body(request)
			.retrieve()
			.toEntity(Map.class);

		// then
		assertThat(createResponse.getStatusCode()).isEqualTo(HttpStatus.CREATED);
		java.net.URI location = createResponse.getHeaders().getLocation();
		assertThat(location).isNotNull();
		assertThat(java.util.Objects.requireNonNull(location).getPath())
			.isEqualTo("/api/v1/applications/e2e-order-service");

		// when — retrieve
		ResponseEntity<Map> getResponse = this.restClient.get()
			.uri("/api/v1/applications/e2e-order-service")
			.retrieve()
			.toEntity(Map.class);

		// then
		assertThat(getResponse.getStatusCode()).isEqualTo(HttpStatus.OK);
		assertThat(getResponse.getBody()).containsEntry("name", "e2e-order-service");
		assertThat(getResponse.getBody()).containsEntry("owner", "e2e-team");
	}

	@Test
	@SuppressWarnings("rawtypes")
	void should_return_409_for_duplicate_registration() {
		// given — register first
		var request = Map.of("name", "e2e-duplicate", "description", "dup", "owner", "team");
		this.restClient.post()
			.uri("/api/v1/applications")
			.contentType(MediaType.APPLICATION_JSON)
			.body(request)
			.retrieve()
			.toEntity(Map.class);

		// when — register same name again
		ResponseEntity<Map> response = this.restClient.post()
			.uri("/api/v1/applications")
			.contentType(MediaType.APPLICATION_JSON)
			.body(request)
			.retrieve()
			.toEntity(Map.class);

		// then
		assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
		assertThat(response.getBody()).containsEntry("code", "APPLICATION_ALREADY_EXISTS");
	}

	@Test
	@SuppressWarnings("rawtypes")
	void should_return_404_for_unknown_application() {
		// when
		ResponseEntity<Map> response = this.restClient.get()
			.uri("/api/v1/applications/e2e-nonexistent")
			.retrieve()
			.toEntity(Map.class);

		// then
		assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
		assertThat(response.getBody()).containsEntry("code", "APPLICATION_NOT_FOUND");
	}

	@Test
	void should_delete_application() {
		// given — register
		var request = Map.of("name", "e2e-to-delete", "description", "delete me", "owner", "team");
		this.restClient.post()
			.uri("/api/v1/applications")
			.contentType(MediaType.APPLICATION_JSON)
			.body(request)
			.retrieve()
			.toEntity(Map.class);

		// when — delete
		ResponseEntity<Void> deleteResponse = this.restClient.delete()
			.uri("/api/v1/applications/e2e-to-delete")
			.retrieve()
			.toBodilessEntity();

		// then
		assertThat(deleteResponse.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);

		// and — verify deleted
		@SuppressWarnings("rawtypes")
		ResponseEntity<Map> getResponse = this.restClient.get()
			.uri("/api/v1/applications/e2e-to-delete")
			.retrieve()
			.toEntity(Map.class);
		assertThat(getResponse.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
	}

	@Test
	@SuppressWarnings("rawtypes")
	void should_list_applications_paginated() {
		// given — register 3 apps
		for (String name : new String[] { "e2e-list-a", "e2e-list-b", "e2e-list-c" }) {
			var request = Map.of("name", name, "description", "list test", "owner", "team");
			this.restClient.post()
				.uri("/api/v1/applications")
				.contentType(MediaType.APPLICATION_JSON)
				.body(request)
				.retrieve()
				.toEntity(Map.class);
		}

		// when — list with pagination
		ResponseEntity<Map> response = this.restClient.get()
			.uri("/api/v1/applications?page=0&size=2&sort=name,asc")
			.retrieve()
			.toEntity(Map.class);

		// then
		assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
		assertThat(response.getBody()).containsKey("content");
		assertThat(response.getBody()).containsKey("totalElements");
	}

}
