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
package sh.stubborn.oss.stubdownloader;

import java.io.File;
import java.util.Map;
import java.util.Objects;

import com.github.tomakehurst.wiremock.WireMockServer;
import org.jspecify.annotations.Nullable;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import sh.stubborn.contract.stubrunner.StubConfiguration;
import sh.stubborn.contract.stubrunner.StubRunnerOptions;
import sh.stubborn.contract.stubrunner.StubRunnerOptionsBuilder;
import sh.stubborn.contract.stubrunner.StubsMode;

import static com.github.tomakehurst.wiremock.client.WireMock.aResponse;
import static com.github.tomakehurst.wiremock.client.WireMock.equalTo;
import static com.github.tomakehurst.wiremock.client.WireMock.equalToJson;
import static com.github.tomakehurst.wiremock.client.WireMock.get;
import static com.github.tomakehurst.wiremock.client.WireMock.getRequestedFor;
import static com.github.tomakehurst.wiremock.client.WireMock.postRequestedFor;
import static com.github.tomakehurst.wiremock.client.WireMock.post;
import static com.github.tomakehurst.wiremock.client.WireMock.urlEqualTo;
import static com.github.tomakehurst.wiremock.client.WireMock.urlPathEqualTo;
import static com.github.tomakehurst.wiremock.core.WireMockConfiguration.wireMockConfig;
import static org.assertj.core.api.Assertions.assertThat;

class BrokerStubDownloaderTest {

	private static final String CONTRACT_YAML = """
			request:
			  method: GET
			  url: /orders/1
			response:
			  status: 200
			  body:
			    id: 1""";

	private static final String CONTRACTS_PAGE_RESPONSE = """
			{
			  "content": [{
			    "contractName": "get-order",
			    "content": "%s",
			    "contentType": "application/x-spring-cloud-contract+yaml"
			  }],
			  "totalElements": 1
			}""".formatted(CONTRACT_YAML.replace("\n", "\\n"));

	private static final String EMPTY_CONTRACTS_PAGE = """
			{
			  "content": [],
			  "totalElements": 0
			}""";

	private static final String APPLICATION_RESPONSE = """
			{
			  "name": "order-service",
			  "latestVersion": "2.0.0"
			}""";

	private WireMockServer wireMock;

	@BeforeEach
	void startWireMock() {
		this.wireMock = new WireMockServer(wireMockConfig().dynamicPort());
		this.wireMock.start();
	}

	@AfterEach
	void stopWireMock() {
		this.wireMock.stop();
	}

	@Test
	void should_download_contracts_and_create_files() {
		// given
		this.wireMock.stubFor(get(urlPathEqualTo("/api/v1/applications/order-service/versions/1.0.0/contracts"))
			.willReturn(aResponse().withStatus(200)
				.withHeader("Content-Type", "application/json")
				.withBody(CONTRACTS_PAGE_RESPONSE)));
		StubRunnerOptions options = new StubRunnerOptionsBuilder().withUsername("admin")
			.withPassword("admin")
			.withStubsMode(StubsMode.REMOTE)
			.build();
		BrokerResource resource = new BrokerResource("stubborn://http://localhost:" + this.wireMock.port());
		BrokerStubDownloader downloader = new BrokerStubDownloader(options, resource);
		StubConfiguration config = new StubConfiguration("com.example", "order-service", "1.0.0", "stubs");

		// when
		Map.@Nullable Entry<StubConfiguration, File> result = downloader.downloadAndUnpackStubJar(config);

		// then
		assertThat(result).isNotNull();
		File tempDir = Objects.requireNonNull(result).getValue();
		assertThat(tempDir).isDirectory();
		File contractsDir = new File(tempDir, "contracts");
		assertThat(contractsDir).isDirectory();
		assertThat(contractsDir.listFiles()).isNotEmpty();
		File mappingsDir = new File(tempDir, "mappings");
		assertThat(mappingsDir).isDirectory();
		assertThat(mappingsDir.listFiles()).isNotEmpty();
	}

	@Test
	void should_resolve_latest_version_when_plus() {
		// given
		this.wireMock
			.stubFor(get(urlPathEqualTo("/api/v1/applications/order-service")).willReturn(aResponse().withStatus(200)
				.withHeader("Content-Type", "application/json")
				.withBody(APPLICATION_RESPONSE)));
		this.wireMock.stubFor(get(urlPathEqualTo("/api/v1/applications/order-service/versions/2.0.0/contracts"))
			.willReturn(aResponse().withStatus(200)
				.withHeader("Content-Type", "application/json")
				.withBody(CONTRACTS_PAGE_RESPONSE)));
		StubRunnerOptions options = new StubRunnerOptionsBuilder().withUsername("admin")
			.withPassword("admin")
			.withStubsMode(StubsMode.REMOTE)
			.build();
		BrokerResource resource = new BrokerResource("stubborn://http://localhost:" + this.wireMock.port());
		BrokerStubDownloader downloader = new BrokerStubDownloader(options, resource);
		StubConfiguration config = new StubConfiguration("com.example", "order-service", "+", "stubs");

		// when
		Map.@Nullable Entry<StubConfiguration, File> result = downloader.downloadAndUnpackStubJar(config);

		// then
		assertThat(result).isNotNull();
		StubConfiguration resolved = Objects.requireNonNull(result).getKey();
		assertThat(resolved.getVersion()).isEqualTo("2.0.0");
	}

	@Test
	void should_return_null_when_no_contracts() {
		// given
		this.wireMock.stubFor(get(urlPathEqualTo("/api/v1/applications/order-service/versions/1.0.0/contracts"))
			.willReturn(aResponse().withStatus(200)
				.withHeader("Content-Type", "application/json")
				.withBody(EMPTY_CONTRACTS_PAGE)));
		StubRunnerOptions options = new StubRunnerOptionsBuilder().withUsername("admin")
			.withPassword("admin")
			.withStubsMode(StubsMode.REMOTE)
			.build();
		BrokerResource resource = new BrokerResource("stubborn://http://localhost:" + this.wireMock.port());
		BrokerStubDownloader downloader = new BrokerStubDownloader(options, resource);
		StubConfiguration config = new StubConfiguration("com.example", "order-service", "1.0.0", "stubs");

		// when
		Map.@Nullable Entry<StubConfiguration, File> result = downloader.downloadAndUnpackStubJar(config);

		// then
		assertThat(result).isNull();
	}

	@Test
	void should_return_null_when_application_not_found() {
		// given — the broker replies 404 with its structured error body when the
		// application (or version) is unknown; this must be treated as "no stubs
		// available" rather than a malformed success response.
		this.wireMock.stubFor(get(urlPathEqualTo("/api/v1/applications/order-service/versions/1.0.0/contracts"))
			.willReturn(aResponse().withStatus(404).withHeader("Content-Type", "application/json").withBody("""
					{
					  "code": "APPLICATION_NOT_FOUND",
					  "message": "Application not found: order-service"
					}""")));
		StubRunnerOptions options = new StubRunnerOptionsBuilder().withUsername("admin")
			.withPassword("admin")
			.withStubsMode(StubsMode.REMOTE)
			.build();
		BrokerResource resource = new BrokerResource("stubborn://http://localhost:" + this.wireMock.port());
		BrokerStubDownloader downloader = new BrokerStubDownloader(options, resource);
		StubConfiguration config = new StubConfiguration("com.example", "order-service", "1.0.0", "stubs");

		// when
		Map.@Nullable Entry<StubConfiguration, File> result = downloader.downloadAndUnpackStubJar(config);

		// then
		assertThat(result).isNull();
	}

	@Test
	void should_send_basic_auth_header() {
		// given
		this.wireMock.stubFor(get(urlPathEqualTo("/api/v1/applications/order-service/versions/1.0.0/contracts"))
			.willReturn(aResponse().withStatus(200)
				.withHeader("Content-Type", "application/json")
				.withBody(CONTRACTS_PAGE_RESPONSE)));
		StubRunnerOptions options = new StubRunnerOptionsBuilder().withUsername("admin")
			.withPassword("admin")
			.withStubsMode(StubsMode.REMOTE)
			.build();
		BrokerResource resource = new BrokerResource("stubborn://http://localhost:" + this.wireMock.port());
		BrokerStubDownloader downloader = new BrokerStubDownloader(options, resource);
		StubConfiguration config = new StubConfiguration("com.example", "order-service", "1.0.0", "stubs");

		// when
		downloader.downloadAndUnpackStubJar(config);

		// then
		this.wireMock.verify(getRequestedFor(urlEqualTo("/api/v1/applications/order-service/versions/1.0.0/contracts"))
			.withHeader("Authorization", equalTo("Basic YWRtaW46YWRtaW4=")));
	}

	@Test
	void should_record_a_dependency_on_the_provider_whose_stubs_it_resolved() {
		// given — the consumer identifies itself, so the broker can attribute the
		// dependency it is about to learn about
		this.wireMock.stubFor(get(urlPathEqualTo("/api/v1/applications/order-service/versions/1.0.0/contracts"))
			.willReturn(aResponse().withStatus(200)
				.withHeader("Content-Type", "application/json")
				.withBody(CONTRACTS_PAGE_RESPONSE)));
		this.wireMock.stubFor(post(urlPathEqualTo("/api/v1/applications/payment-service/versions/2.0.0/dependencies"))
			.willReturn(aResponse().withStatus(201)));
		StubRunnerOptions options = new StubRunnerOptionsBuilder().withUsername("admin")
			.withPassword("admin")
			.withStubsMode(StubsMode.REMOTE)
			.withProperties(Map.of("stubborn.contract.stubrunner.consumer.name", "payment-service",
					"stubborn.contract.stubrunner.consumer.version", "2.0.0"))
			.build();
		BrokerResource resource = new BrokerResource("stubborn://http://localhost:" + this.wireMock.port());
		BrokerStubDownloader downloader = new BrokerStubDownloader(options, resource);
		StubConfiguration config = new StubConfiguration("com.example", "order-service", "1.0.0", "stubs");

		// when
		Map.@Nullable Entry<StubConfiguration, File> result = downloader.downloadAndUnpackStubJar(config);

		// then
		assertThat(result).isNotNull();
		this.wireMock
			.verify(postRequestedFor(urlPathEqualTo("/api/v1/applications/payment-service/versions/2.0.0/dependencies"))
				.withRequestBody(equalToJson("{\"provider\":\"order-service\"}")));
	}

	@Test
	void should_not_record_a_dependency_when_the_consumer_is_not_identified() {
		// given — no consumer identity configured, so there is nothing to attribute it to
		this.wireMock.stubFor(get(urlPathEqualTo("/api/v1/applications/order-service/versions/1.0.0/contracts"))
			.willReturn(aResponse().withStatus(200)
				.withHeader("Content-Type", "application/json")
				.withBody(CONTRACTS_PAGE_RESPONSE)));
		StubRunnerOptions options = new StubRunnerOptionsBuilder().withUsername("admin")
			.withPassword("admin")
			.withStubsMode(StubsMode.REMOTE)
			.build();
		BrokerResource resource = new BrokerResource("stubborn://http://localhost:" + this.wireMock.port());
		BrokerStubDownloader downloader = new BrokerStubDownloader(options, resource);
		StubConfiguration config = new StubConfiguration("com.example", "order-service", "1.0.0", "stubs");

		// when
		Map.@Nullable Entry<StubConfiguration, File> result = downloader.downloadAndUnpackStubJar(config);

		// then — stubs still resolve, and nothing is posted
		assertThat(result).isNotNull();
		this.wireMock.verify(0,
				postRequestedFor(urlPathEqualTo("/api/v1/applications/payment-service/versions/2.0.0/dependencies")));
	}

	@Test
	void should_still_resolve_stubs_when_recording_the_dependency_fails() {
		// given — the broker rejects the bookkeeping call; resolving stubs is what the
		// caller asked for and must not fail because of it
		this.wireMock.stubFor(get(urlPathEqualTo("/api/v1/applications/order-service/versions/1.0.0/contracts"))
			.willReturn(aResponse().withStatus(200)
				.withHeader("Content-Type", "application/json")
				.withBody(CONTRACTS_PAGE_RESPONSE)));
		this.wireMock.stubFor(post(urlPathEqualTo("/api/v1/applications/payment-service/versions/2.0.0/dependencies"))
			.willReturn(aResponse().withStatus(500)));
		StubRunnerOptions options = new StubRunnerOptionsBuilder().withUsername("admin")
			.withPassword("admin")
			.withStubsMode(StubsMode.REMOTE)
			.withProperties(Map.of("stubborn.contract.stubrunner.consumer.name", "payment-service",
					"stubborn.contract.stubrunner.consumer.version", "2.0.0"))
			.build();
		BrokerResource resource = new BrokerResource("stubborn://http://localhost:" + this.wireMock.port());
		BrokerStubDownloader downloader = new BrokerStubDownloader(options, resource);
		StubConfiguration config = new StubConfiguration("com.example", "order-service", "1.0.0", "stubs");

		// when
		Map.@Nullable Entry<StubConfiguration, File> result = downloader.downloadAndUnpackStubJar(config);

		// then
		assertThat(result).isNotNull();
		assertThat(Objects.requireNonNull(result).getValue()).isDirectory();
	}

}
