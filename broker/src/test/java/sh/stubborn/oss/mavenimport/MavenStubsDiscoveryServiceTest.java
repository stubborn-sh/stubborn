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
package sh.stubborn.oss.mavenimport;

import java.util.List;
import java.util.Objects;

import com.github.tomakehurst.wiremock.junit5.WireMockExtension;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.RegisterExtension;

import org.springframework.web.client.RestClient;

import static com.github.tomakehurst.wiremock.client.WireMock.aResponse;
import static com.github.tomakehurst.wiremock.client.WireMock.equalTo;
import static com.github.tomakehurst.wiremock.client.WireMock.get;
import static com.github.tomakehurst.wiremock.client.WireMock.urlPathEqualTo;
import static com.github.tomakehurst.wiremock.core.WireMockConfiguration.wireMockConfig;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * @see <a href="../../../docs/specs/032-maven-stubs-discovery.md">Spec 032 — Maven Stubs
 * Discovery</a>
 */
class MavenStubsDiscoveryServiceTest {

	@RegisterExtension
	static WireMockExtension wireMock = WireMockExtension.newInstance().options(wireMockConfig().dynamicPort()).build();

	MavenStubsDiscoveryService service;

	@BeforeEach
	void setUp() {
		this.service = new MavenStubsDiscoveryService(RestClient.builder());
	}

	@Test
	void should_discover_stubs_from_nexus() {
		// given
		wireMock
			.stubFor(get(urlPathEqualTo("/service/rest/v1/search")).withQueryParam("maven.classifier", equalTo("stubs"))
				.withQueryParam("maven.extension", equalTo("jar"))
				.willReturn(aResponse().withHeader("Content-Type", "application/json").withBody("""
						{
						  "items": [
						    {
						      "group": "com.example",
						      "name": "order-service",
						      "version": "2.1.0"
						    },
						    {
						      "group": "com.example",
						      "name": "payment-service",
						      "version": "1.5.0"
						    }
						  ]
						}
						""")));

		// when
		List<DiscoveredStub> stubs = this.service.discover(wireMock.baseUrl(), RepositoryType.NEXUS, null, null);

		// then
		assertThat(stubs).hasSize(2);
		assertThat(stubs).extracting(DiscoveredStub::groupId).containsExactly("com.example", "com.example");
		assertThat(stubs).extracting(DiscoveredStub::artifactId).containsExactly("order-service", "payment-service");
		assertThat(stubs).extracting(DiscoveredStub::latestVersion).containsExactly("2.1.0", "1.5.0");
	}

	@Test
	void should_discover_stubs_from_nexus_with_credentials() {
		// given
		wireMock
			.stubFor(get(urlPathEqualTo("/service/rest/v1/search")).withQueryParam("maven.classifier", equalTo("stubs"))
				.withQueryParam("maven.extension", equalTo("jar"))
				.withHeader("Authorization", equalTo("Basic dXNlcjpwYXNz"))
				.willReturn(aResponse().withHeader("Content-Type", "application/json").withBody("""
						{
						  "items": [
						    {
						      "group": "com.example",
						      "name": "secured-service",
						      "version": "1.0.0"
						    }
						  ]
						}
						""")));

		// when
		List<DiscoveredStub> stubs = this.service.discover(wireMock.baseUrl(), RepositoryType.NEXUS, "user", "pass");

		// then
		assertThat(stubs).hasSize(1);
		assertThat(stubs.get(0).artifactId()).isEqualTo("secured-service");
	}

	@Test
	void should_discover_stubs_from_artifactory() {
		// given
		wireMock.stubFor(get(urlPathEqualTo("/api/search/gavc")).withQueryParam("c", equalTo("stubs"))
			.withQueryParam("repos", equalTo("*"))
			.willReturn(aResponse().withHeader("Content-Type", "application/json")
				.withBody(
						"""
								{
								  "results": [
								    {
								      "uri": "https://repo.example.com/api/storage/libs-release/com/example/order-service/2.0.0/order-service-2.0.0-stubs.jar"
								    },
								    {
								      "uri": "https://repo.example.com/api/storage/libs-release/org/acme/billing/1.3.0/billing-1.3.0-stubs.jar"
								    }
								  ]
								}
								""")));

		// when
		List<DiscoveredStub> stubs = this.service.discover(wireMock.baseUrl(), RepositoryType.ARTIFACTORY, null, null);

		// then
		assertThat(stubs).hasSize(2);
		assertThat(stubs.get(0).groupId()).isEqualTo("com.example");
		assertThat(stubs.get(0).artifactId()).isEqualTo("order-service");
		assertThat(stubs.get(0).latestVersion()).isEqualTo("2.0.0");
		assertThat(stubs.get(1).groupId()).isEqualTo("org.acme");
		assertThat(stubs.get(1).artifactId()).isEqualTo("billing");
		assertThat(stubs.get(1).latestVersion()).isEqualTo("1.3.0");
	}

	@Test
	void should_discover_stubs_from_central() {
		// given — Central search URL is hardcoded, so we test via a service that uses
		// a configurable central URL pointing at WireMock
		wireMock.stubFor(get(urlPathEqualTo("/solrsearch/select")).withQueryParam("q", equalTo("c:stubs"))
			.withQueryParam("rows", equalTo("50"))
			.withQueryParam("wt", equalTo("json"))
			.willReturn(aResponse().withHeader("Content-Type", "application/json").withBody("""
					{
					  "response": {
					    "numFound": 2,
					    "docs": [
					      {
					        "g": "org.springframework.cloud",
					        "a": "spring-cloud-contract-spec",
					        "latestVersion": "4.2.0"
					      },
					      {
					        "g": "com.example",
					        "a": "demo-stubs",
					        "latestVersion": "1.0.0"
					      }
					    ]
					  }
					}
					""")));

		// Create a service with overridden Central URL
		MavenStubsDiscoveryService centralService = new MavenStubsDiscoveryService(RestClient.builder(),
				wireMock.baseUrl());

		// when
		List<DiscoveredStub> stubs = centralService.discover("https://search.maven.org", RepositoryType.CENTRAL, null,
				null);

		// then
		assertThat(stubs).hasSize(2);
		assertThat(stubs.get(0).groupId()).isEqualTo("org.springframework.cloud");
		assertThat(stubs.get(0).artifactId()).isEqualTo("spring-cloud-contract-spec");
		assertThat(stubs.get(0).latestVersion()).isEqualTo("4.2.0");
		assertThat(stubs.get(1).groupId()).isEqualTo("com.example");
		assertThat(stubs.get(1).artifactId()).isEqualTo("demo-stubs");
		assertThat(stubs.get(1).latestVersion()).isEqualTo("1.0.0");
	}

	@Test
	void should_return_empty_list_when_nexus_has_no_items() {
		// given
		wireMock
			.stubFor(get(urlPathEqualTo("/service/rest/v1/search")).withQueryParam("maven.classifier", equalTo("stubs"))
				.withQueryParam("maven.extension", equalTo("jar"))
				.willReturn(aResponse().withHeader("Content-Type", "application/json").withBody("""
						{
						  "items": []
						}
						""")));

		// when
		List<DiscoveredStub> stubs = this.service.discover(wireMock.baseUrl(), RepositoryType.NEXUS, null, null);

		// then
		assertThat(stubs).isEmpty();
	}

	@Test
	void should_return_empty_list_when_artifactory_has_no_results() {
		// given
		wireMock.stubFor(get(urlPathEqualTo("/api/search/gavc")).withQueryParam("c", equalTo("stubs"))
			.withQueryParam("repos", equalTo("*"))
			.willReturn(aResponse().withHeader("Content-Type", "application/json").withBody("""
					{
					  "results": []
					}
					""")));

		// when
		List<DiscoveredStub> stubs = this.service.discover(wireMock.baseUrl(), RepositoryType.ARTIFACTORY, null, null);

		// then
		assertThat(stubs).isEmpty();
	}

	@Test
	void should_throw_when_repository_is_unreachable() {
		// given — use a port that nothing is listening on
		String unreachableUrl = "http://localhost:19999";

		// then
		assertThatThrownBy(() -> this.service.discover(unreachableUrl, RepositoryType.NEXUS, null, null))
			.isInstanceOf(MavenImportException.class)
			.hasMessageContaining("Failed to search repository");
	}

	@Test
	void should_throw_when_url_scheme_is_invalid() {
		assertThatThrownBy(() -> this.service.discover("ftp://repo.example.com", RepositoryType.NEXUS, null, null))
			.isInstanceOf(MavenImportException.class)
			.hasMessageContaining("Invalid repository URL scheme");
	}

	@Test
	void should_skip_nexus_items_with_null_fields() {
		// given
		wireMock
			.stubFor(get(urlPathEqualTo("/service/rest/v1/search")).withQueryParam("maven.classifier", equalTo("stubs"))
				.withQueryParam("maven.extension", equalTo("jar"))
				.willReturn(aResponse().withHeader("Content-Type", "application/json").withBody("""
						{
						  "items": [
						    {
						      "group": "com.example",
						      "name": "valid-service",
						      "version": "1.0.0"
						    },
						    {
						      "group": null,
						      "name": "invalid-service",
						      "version": "1.0.0"
						    },
						    {
						      "group": "com.example",
						      "name": null,
						      "version": "1.0.0"
						    }
						  ]
						}
						""")));

		// when
		List<DiscoveredStub> stubs = this.service.discover(wireMock.baseUrl(), RepositoryType.NEXUS, null, null);

		// then
		assertThat(stubs).hasSize(1);
		assertThat(stubs.get(0).artifactId()).isEqualTo("valid-service");
	}

	@Test
	void should_parse_artifactory_uri_correctly() {
		// given
		String uri = "https://repo.example.com/api/storage/libs-release/com/example/order-service/1.0.0/order-service-1.0.0-stubs.jar";

		// when
		DiscoveredStub stub = Objects.requireNonNull(MavenStubsDiscoveryService.parseArtifactoryUri(uri));

		// then
		assertThat(stub.groupId()).isEqualTo("com.example");
		assertThat(stub.artifactId()).isEqualTo("order-service");
		assertThat(stub.latestVersion()).isEqualTo("1.0.0");
	}

	@Test
	void should_parse_artifactory_uri_with_deep_group() {
		// given
		String uri = "https://repo.example.com/api/storage/libs-release/org/springframework/cloud/spring-cloud-contract-stub-runner/4.2.0/spring-cloud-contract-stub-runner-4.2.0-stubs.jar";

		// when
		DiscoveredStub stub = Objects.requireNonNull(MavenStubsDiscoveryService.parseArtifactoryUri(uri));

		// then
		assertThat(stub.groupId()).isEqualTo("org.springframework.cloud");
		assertThat(stub.artifactId()).isEqualTo("spring-cloud-contract-stub-runner");
		assertThat(stub.latestVersion()).isEqualTo("4.2.0");
	}

	@Test
	void should_return_null_for_malformed_artifactory_uri() {
		// given — too few segments
		String uri = "https://repo.example.com/api/storage/libs-release/short";

		// when
		DiscoveredStub stub = MavenStubsDiscoveryService.parseArtifactoryUri(uri);

		// then
		assertThat(stub).isNull();
	}

}
