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
package org.springframework.cloud.contract.broker.stubdownloader;

import java.io.File;
import java.util.Map;
import java.util.Objects;

import com.github.tomakehurst.wiremock.WireMockServer;
import org.jspecify.annotations.Nullable;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import org.springframework.cloud.contract.stubrunner.StubConfiguration;
import org.springframework.cloud.contract.stubrunner.StubRunnerOptions;
import org.springframework.cloud.contract.stubrunner.StubRunnerOptionsBuilder;
import org.springframework.cloud.contract.stubrunner.spring.StubRunnerProperties;

import static com.github.tomakehurst.wiremock.client.WireMock.aResponse;
import static com.github.tomakehurst.wiremock.client.WireMock.equalTo;
import static com.github.tomakehurst.wiremock.client.WireMock.get;
import static com.github.tomakehurst.wiremock.client.WireMock.getRequestedFor;
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
			.withStubsMode(StubRunnerProperties.StubsMode.REMOTE)
			.build();
		BrokerResource resource = new BrokerResource("sccbroker://http://localhost:" + this.wireMock.port());
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
			.withStubsMode(StubRunnerProperties.StubsMode.REMOTE)
			.build();
		BrokerResource resource = new BrokerResource("sccbroker://http://localhost:" + this.wireMock.port());
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
			.withStubsMode(StubRunnerProperties.StubsMode.REMOTE)
			.build();
		BrokerResource resource = new BrokerResource("sccbroker://http://localhost:" + this.wireMock.port());
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
			.withStubsMode(StubRunnerProperties.StubsMode.REMOTE)
			.build();
		BrokerResource resource = new BrokerResource("sccbroker://http://localhost:" + this.wireMock.port());
		BrokerStubDownloader downloader = new BrokerStubDownloader(options, resource);
		StubConfiguration config = new StubConfiguration("com.example", "order-service", "1.0.0", "stubs");

		// when
		downloader.downloadAndUnpackStubJar(config);

		// then
		this.wireMock.verify(getRequestedFor(urlEqualTo("/api/v1/applications/order-service/versions/1.0.0/contracts"))
			.withHeader("Authorization", equalTo("Basic YWRtaW46YWRtaW4=")));
	}

}
