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
package sh.stubborn.oss.stubdownloader.scc;

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
import static com.github.tomakehurst.wiremock.client.WireMock.get;
import static com.github.tomakehurst.wiremock.client.WireMock.urlPathEqualTo;
import static com.github.tomakehurst.wiremock.core.WireMockConfiguration.wireMockConfig;
import static org.assertj.core.api.Assertions.assertThat;

/**
 * Verifies the Spring Cloud Contract 5.x backward-compatibility downloader can still
 * fetch contracts from the broker, so consumers on SCC 5.x keep working.
 */
class SccBrokerStubDownloaderTest {

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
	void should_download_contracts_via_legacy_scc_api() {
		// given
		this.wireMock.stubFor(get(urlPathEqualTo("/api/v1/applications/order-service/versions/1.0.0/contracts"))
			.willReturn(aResponse().withStatus(200)
				.withHeader("Content-Type", "application/json")
				.withBody(CONTRACTS_PAGE_RESPONSE)));
		StubRunnerOptions options = new StubRunnerOptionsBuilder().withUsername("admin")
			.withPassword("admin")
			.withStubsMode(StubRunnerProperties.StubsMode.REMOTE)
			.build();
		SccBrokerResource resource = new SccBrokerResource("sccbroker://http://localhost:" + this.wireMock.port());
		SccBrokerStubDownloader downloader = new SccBrokerStubDownloader(options, resource);
		StubConfiguration config = new StubConfiguration("com.example", "order-service", "1.0.0", "stubs");

		// when
		Map.@Nullable Entry<StubConfiguration, File> result = downloader.downloadAndUnpackStubJar(config);

		// then
		assertThat(result).isNotNull();
		File tempDir = Objects.requireNonNull(result).getValue();
		assertThat(tempDir).isDirectory();
		assertThat(new File(tempDir, "contracts").listFiles()).isNotEmpty();
		assertThat(new File(tempDir, "mappings").listFiles()).isNotEmpty();
	}

}
