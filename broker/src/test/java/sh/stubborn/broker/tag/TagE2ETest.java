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
package sh.stubborn.broker.tag;

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
class TagE2ETest {

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
	void should_add_and_list_tags() {
		// given — register app and publish contract
		registerApplication("e2e-tag-app");
		publishContract("e2e-tag-app", "1.0.0", "tag-contract");

		// when — add tag
		ResponseEntity<Map> addResponse = this.restClient.put()
			.uri("/api/v1/applications/e2e-tag-app/versions/1.0.0/tags/RELEASE")
			.retrieve()
			.toEntity(Map.class);
		assertThat(addResponse.getStatusCode()).isEqualTo(HttpStatus.OK);
		assertThat(Objects.requireNonNull(addResponse.getBody()).get("tag")).isEqualTo("RELEASE");

		// then — list tags
		ResponseEntity<List> listResponse = this.restClient.get()
			.uri("/api/v1/applications/e2e-tag-app/versions/1.0.0/tags")
			.retrieve()
			.toEntity(List.class);
		assertThat(listResponse.getStatusCode()).isEqualTo(HttpStatus.OK);
		List<Map<String, Object>> tags = Objects.requireNonNull(listResponse.getBody());
		assertThat(tags).anyMatch(t -> "RELEASE".equals(t.get("tag")));
	}

	@Test
	@SuppressWarnings("rawtypes")
	void should_get_latest_version_by_tag() {
		// given
		registerApplication("e2e-tag-latest-app");
		publishContract("e2e-tag-latest-app", "1.0.0", "latest-contract");
		publishContract("e2e-tag-latest-app", "2.0.0", "latest-contract");
		this.restClient.put()
			.uri("/api/v1/applications/e2e-tag-latest-app/versions/1.0.0/tags/STABLE")
			.retrieve()
			.toEntity(Map.class);
		this.restClient.put()
			.uri("/api/v1/applications/e2e-tag-latest-app/versions/2.0.0/tags/STABLE")
			.retrieve()
			.toEntity(Map.class);

		// when
		ResponseEntity<Map> response = this.restClient.get()
			.uri("/api/v1/applications/e2e-tag-latest-app/versions/latest?tag=STABLE")
			.retrieve()
			.toEntity(Map.class);

		// then
		assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
		assertThat(Objects.requireNonNull(response.getBody()).get("version")).isEqualTo("2.0.0");
	}

	@Test
	void should_remove_tag() {
		// given
		registerApplication("e2e-tag-remove-app");
		publishContract("e2e-tag-remove-app", "1.0.0", "remove-contract");
		this.restClient.put()
			.uri("/api/v1/applications/e2e-tag-remove-app/versions/1.0.0/tags/REMOVEME")
			.retrieve()
			.toEntity(Map.class);

		// when
		ResponseEntity<Void> response = this.restClient.delete()
			.uri("/api/v1/applications/e2e-tag-remove-app/versions/1.0.0/tags/REMOVEME")
			.retrieve()
			.toBodilessEntity();

		// then
		assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
	}

	@SuppressWarnings("rawtypes")
	private void registerApplication(String name) {
		this.restClient.post()
			.uri("/api/v1/applications")
			.contentType(MediaType.APPLICATION_JSON)
			.body(Map.of("name", name, "description", "E2E tag test app", "owner", "team"))
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

}
