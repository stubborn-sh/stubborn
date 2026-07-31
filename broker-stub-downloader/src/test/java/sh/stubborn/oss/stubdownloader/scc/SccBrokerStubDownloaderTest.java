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
import static com.github.tomakehurst.wiremock.client.WireMock.equalTo;
import static com.github.tomakehurst.wiremock.client.WireMock.get;
import static com.github.tomakehurst.wiremock.client.WireMock.getRequestedFor;
import static com.github.tomakehurst.wiremock.client.WireMock.urlEqualTo;
import static com.github.tomakehurst.wiremock.client.WireMock.urlPathEqualTo;
import static com.github.tomakehurst.wiremock.core.WireMockConfiguration.wireMockConfig;
import static org.assertj.core.api.Assertions.assertThat;

/**
 * Verifies the Spring Cloud Contract 5.x backward-compatibility downloader end-to-end
 * against the broker (REST endpoints, Basic auth, version resolution, empty-result
 * handling, and downloading contracts), so consumers on SCC 5.x keep working.
 *
 * <p>
 * The one thing these tests cannot assert here is the WireMock <em>mapping</em> output:
 * that step runs Spring Cloud Contract 5.x's Groovy {@code Contract} parser, which cannot
 * execute inside this module's test classpath because it also carries Stubborn Contract's
 * Groovy 5 runtime. The download treats that conversion as best-effort (it logs and
 * continues), so the contracts are still delivered. In a real SCC 5.x consumer the two
 * ecosystems never mix (the broker's Stubborn/SCC dependencies are {@code provided}), so
 * the mapping conversion also succeeds there — and it is exercised end-to-end (contracts
 * <em>and</em> mappings) by
 * {@link sh.stubborn.oss.stubdownloader.BrokerStubDownloaderTest} against the primary
 * Stubborn Contract implementation, which shares the same download logic.
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

	private static final String EMPTY_CONTRACTS_PAGE = """
			{
			  "content": [],
			  "totalElements": 0
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
	void should_return_null_when_broker_has_no_contracts() {
		// given
		this.wireMock.stubFor(get(urlPathEqualTo("/api/v1/applications/order-service/versions/1.0.0/contracts"))
			.willReturn(aResponse().withStatus(200)
				.withHeader("Content-Type", "application/json")
				.withBody(EMPTY_CONTRACTS_PAGE)));
		SccBrokerStubDownloader downloader = downloaderFor("order-service");
		StubConfiguration config = new StubConfiguration("com.example", "order-service", "1.0.0", "stubs");

		// when
		Map.@Nullable Entry<StubConfiguration, File> result = downloader.downloadAndUnpackStubJar(config);

		// then
		assertThat(result).isNull();
	}

	@Test
	void should_download_and_write_contracts() {
		// given
		this.wireMock.stubFor(get(urlPathEqualTo("/api/v1/applications/order-service/versions/1.0.0/contracts"))
			.willReturn(aResponse().withStatus(200)
				.withHeader("Content-Type", "application/json")
				.withBody(CONTRACTS_PAGE_RESPONSE)));
		SccBrokerStubDownloader downloader = downloaderFor("order-service");
		StubConfiguration config = new StubConfiguration("com.example", "order-service", "1.0.0", "stubs");

		// when
		Map.@Nullable Entry<StubConfiguration, File> result = downloader.downloadAndUnpackStubJar(config);

		// then — contracts are delivered (WireMock mapping conversion is best-effort; see
		// the class javadoc for why the mapping step cannot run in this module's
		// classpath).
		assertThat(result).isNotNull();
		File tempDir = Objects.requireNonNull(result).getValue();
		assertThat(tempDir).isDirectory();
		assertThat(new File(tempDir, "contracts").listFiles()).isNotEmpty();
	}

	@Test
	void should_authenticate_to_broker_with_basic_auth() {
		// given
		this.wireMock.stubFor(get(urlPathEqualTo("/api/v1/applications/order-service/versions/1.0.0/contracts"))
			.willReturn(aResponse().withStatus(200)
				.withHeader("Content-Type", "application/json")
				.withBody(EMPTY_CONTRACTS_PAGE)));
		SccBrokerStubDownloader downloader = downloaderFor("order-service");
		StubConfiguration config = new StubConfiguration("com.example", "order-service", "1.0.0", "stubs");

		// when
		downloader.downloadAndUnpackStubJar(config);

		// then
		this.wireMock.verify(getRequestedFor(urlEqualTo("/api/v1/applications/order-service/versions/1.0.0/contracts"))
			.withHeader("Authorization", equalTo("Basic YWRtaW46YWRtaW4=")));
	}

	@Test
	void should_resolve_latest_version_from_broker() {
		// given
		this.wireMock.stubFor(get(urlPathEqualTo("/api/v1/applications/order-service"))
			.willReturn(aResponse().withStatus(200).withHeader("Content-Type", "application/json").withBody("""
					{
					  "name": "order-service",
					  "latestVersion": "2.0.0"
					}""")));
		this.wireMock.stubFor(get(urlPathEqualTo("/api/v1/applications/order-service/versions/2.0.0/contracts"))
			.willReturn(aResponse().withStatus(200)
				.withHeader("Content-Type", "application/json")
				.withBody(EMPTY_CONTRACTS_PAGE)));
		SccBrokerStubDownloader downloader = downloaderFor("order-service");
		StubConfiguration config = new StubConfiguration("com.example", "order-service", "+", "stubs");

		// when
		downloader.downloadAndUnpackStubJar(config);

		// then
		this.wireMock.verify(getRequestedFor(urlPathEqualTo("/api/v1/applications/order-service")));
		this.wireMock
			.verify(getRequestedFor(urlPathEqualTo("/api/v1/applications/order-service/versions/2.0.0/contracts")));
	}

	private SccBrokerStubDownloader downloaderFor(String ignoredApp) {
		StubRunnerOptions options = new StubRunnerOptionsBuilder().withUsername("admin")
			.withPassword("admin")
			.withStubsMode(StubRunnerProperties.StubsMode.REMOTE)
			.build();
		SccBrokerResource resource = new SccBrokerResource("sccbroker://http://localhost:" + this.wireMock.port());
		return new SccBrokerStubDownloader(options, resource);
	}

}
