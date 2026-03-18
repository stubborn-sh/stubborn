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
package org.springframework.cloud.contract.broker.webhook;

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
class WebhookE2ETest {

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
	void should_create_and_list_webhooks() {
		// given — create a webhook
		ResponseEntity<Map> createResponse = this.restClient.post()
			.uri("/api/v1/webhooks")
			.contentType(MediaType.APPLICATION_JSON)
			.body(Map.of("eventType", "CONTRACT_PUBLISHED", "url", "https://e2e-hooks.example.com/contracts"))
			.retrieve()
			.toEntity(Map.class);
		assertThat(createResponse.getStatusCode()).isEqualTo(HttpStatus.CREATED);

		// when — list webhooks
		ResponseEntity<Map> listResponse = this.restClient.get().uri("/api/v1/webhooks").retrieve().toEntity(Map.class);

		// then
		assertThat(listResponse.getStatusCode()).isEqualTo(HttpStatus.OK);
		Map<String, Object> body = Objects.requireNonNull(listResponse.getBody());
		assertThat(body.get("totalElements")).isNotNull();
	}

	@Test
	@SuppressWarnings("rawtypes")
	void should_get_webhook_by_id() {
		// given
		ResponseEntity<Map> createResponse = this.restClient.post()
			.uri("/api/v1/webhooks")
			.contentType(MediaType.APPLICATION_JSON)
			.body(Map.of("eventType", "VERIFICATION_FAILED", "url", "https://e2e-hooks.example.com/failures"))
			.retrieve()
			.toEntity(Map.class);
		String webhookId = (String) Objects.requireNonNull(createResponse.getBody()).get("id");

		// when
		ResponseEntity<Map> getResponse = this.restClient.get()
			.uri("/api/v1/webhooks/" + webhookId)
			.retrieve()
			.toEntity(Map.class);

		// then
		assertThat(getResponse.getStatusCode()).isEqualTo(HttpStatus.OK);
		assertThat(Objects.requireNonNull(getResponse.getBody()).get("eventType")).isEqualTo("VERIFICATION_FAILED");
	}

	@Test
	@SuppressWarnings("rawtypes")
	void should_delete_webhook() {
		// given
		ResponseEntity<Map> createResponse = this.restClient.post()
			.uri("/api/v1/webhooks")
			.contentType(MediaType.APPLICATION_JSON)
			.body(Map.of("eventType", "DEPLOYMENT_RECORDED", "url", "https://e2e-hooks.example.com/deleteme"))
			.retrieve()
			.toEntity(Map.class);
		String webhookId = (String) Objects.requireNonNull(createResponse.getBody()).get("id");

		// when
		ResponseEntity<Void> deleteResponse = this.restClient.delete()
			.uri("/api/v1/webhooks/" + webhookId)
			.retrieve()
			.toBodilessEntity();

		// then
		assertThat(deleteResponse.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
	}

}
