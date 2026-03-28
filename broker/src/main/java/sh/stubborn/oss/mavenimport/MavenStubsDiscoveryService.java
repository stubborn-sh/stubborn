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

import java.net.URI;
import java.net.http.HttpClient;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import io.micrometer.observation.annotation.Observed;
import org.jspecify.annotations.Nullable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

@Service
public class MavenStubsDiscoveryService {

	private static final Logger logger = LoggerFactory.getLogger(MavenStubsDiscoveryService.class);

	private static final String DEFAULT_CENTRAL_BASE_URL = "https://search.maven.org";

	private static final List<String> ALLOWED_SCHEMES = List.of("http", "https");

	static final Duration CONNECT_TIMEOUT = Duration.ofSeconds(5);

	static final Duration READ_TIMEOUT = Duration.ofSeconds(15);

	private final RestClient restClient;

	private final String centralBaseUrl;

	@Autowired
	public MavenStubsDiscoveryService(RestClient.Builder restClientBuilder) {
		this(restClientBuilder, DEFAULT_CENTRAL_BASE_URL);
	}

	MavenStubsDiscoveryService(RestClient.Builder restClientBuilder, String centralBaseUrl) {
		HttpClient httpClient = HttpClient.newBuilder().connectTimeout(CONNECT_TIMEOUT).build();
		JdkClientHttpRequestFactory requestFactory = new JdkClientHttpRequestFactory(httpClient);
		requestFactory.setReadTimeout(READ_TIMEOUT);
		this.restClient = restClientBuilder.requestFactory(requestFactory).build();
		this.centralBaseUrl = centralBaseUrl;
	}

	@Observed(name = "broker.mavenimport.discover-stubs")
	@CircuitBreaker(name = "mavenImport")
	List<DiscoveredStub> discover(String repositoryUrl, RepositoryType repositoryType, @Nullable String username,
			@Nullable String password) {
		validateUrl(repositoryUrl);
		logger.info("Discovering stubs from {} repository at {}", repositoryType, repositoryUrl);
		return switch (repositoryType) {
			case NEXUS -> discoverFromNexus(repositoryUrl, username, password);
			case ARTIFACTORY -> discoverFromArtifactory(repositoryUrl, username, password);
			case CENTRAL -> discoverFromCentral();
		};
	}

	@SuppressWarnings("unchecked")
	private List<DiscoveredStub> discoverFromNexus(String repositoryUrl, @Nullable String username,
			@Nullable String password) {
		String baseUrl = repositoryUrl.replaceAll("/+$", "");
		String searchUrl = baseUrl + "/service/rest/v1/search?maven.classifier=stubs&maven.extension=jar";

		Map<String, Object> response = executeSearch(searchUrl, username, password);
		List<Map<String, Object>> items = (List<Map<String, Object>>) response.getOrDefault("items", List.of());

		List<DiscoveredStub> stubs = new ArrayList<>();
		for (Map<String, Object> item : items) {
			String group = (String) item.get("group");
			String name = (String) item.get("name");
			String version = (String) item.get("version");
			if (group != null && name != null && version != null) {
				stubs.add(new DiscoveredStub(group, name, version));
			}
		}

		logger.info("Discovered {} stubs from Nexus at {}", stubs.size(), repositoryUrl);
		return stubs;
	}

	@SuppressWarnings("unchecked")
	private List<DiscoveredStub> discoverFromArtifactory(String repositoryUrl, @Nullable String username,
			@Nullable String password) {
		String baseUrl = repositoryUrl.replaceAll("/+$", "");
		String searchUrl = baseUrl + "/api/search/gavc?c=stubs&repos=*";

		Map<String, Object> response = executeSearch(searchUrl, username, password);
		List<Map<String, String>> results = (List<Map<String, String>>) response.getOrDefault("results", List.of());

		List<DiscoveredStub> stubs = new ArrayList<>();
		for (Map<String, String> result : results) {
			String uri = result.get("uri");
			if (uri != null) {
				DiscoveredStub stub = parseArtifactoryUri(uri);
				if (stub != null) {
					stubs.add(stub);
				}
			}
		}

		logger.info("Discovered {} stubs from Artifactory at {}", stubs.size(), repositoryUrl);
		return stubs;
	}

	@SuppressWarnings("unchecked")
	private List<DiscoveredStub> discoverFromCentral() {
		String searchUrl = this.centralBaseUrl + "/solrsearch/select?q=c:stubs&rows=50&wt=json";

		Map<String, Object> response = executeSearch(searchUrl, null, null);
		Map<String, Object> responseBody = (Map<String, Object>) response.getOrDefault("response", Map.of());
		List<Map<String, String>> docs = (List<Map<String, String>>) responseBody.getOrDefault("docs", List.of());

		List<DiscoveredStub> stubs = new ArrayList<>();
		for (Map<String, String> doc : docs) {
			String groupId = doc.get("g");
			String artifactId = doc.get("a");
			String latestVersion = doc.get("latestVersion");
			if (groupId != null && artifactId != null && latestVersion != null) {
				stubs.add(new DiscoveredStub(groupId, artifactId, latestVersion));
			}
		}

		logger.info("Discovered {} stubs from Maven Central", stubs.size());
		return stubs;
	}

	@SuppressWarnings("unchecked")
	private Map<String, Object> executeSearch(String searchUrl, @Nullable String username, @Nullable String password) {
		try {
			RestClient.RequestHeadersSpec<?> request = this.restClient.get().uri(searchUrl);
			if (username != null && password != null) {
				request = request.header("Authorization", "Basic " + java.util.Base64.getEncoder()
					.encodeToString((username + ":" + password).getBytes(StandardCharsets.UTF_8)));
			}

			Map<String, Object> body = request.retrieve().body(Map.class);
			if (body == null) {
				throw new MavenImportException("Empty response from " + searchUrl);
			}
			return body;
		}
		catch (MavenImportException ex) {
			throw ex;
		}
		catch (Exception ex) {
			throw new MavenImportException("Failed to search repository at " + searchUrl + ": " + ex.getMessage(), ex);
		}
	}

	@Nullable static DiscoveredStub parseArtifactoryUri(String uri) {
		// Artifactory URI format:
		// https://repo.example.com/api/storage/libs-release/com/example/order-service/1.0.0/order-service-1.0.0-stubs.jar
		try {
			String path = URI.create(uri).getPath();
			// Remove /api/storage/{repoKey}/ prefix
			int storageIdx = path.indexOf("/api/storage/");
			if (storageIdx >= 0) {
				path = path.substring(storageIdx + "/api/storage/".length());
				// Skip repo key (first segment)
				int slashIdx = path.indexOf('/');
				if (slashIdx >= 0) {
					path = path.substring(slashIdx + 1);
				}
			}

			// Now path is like:
			// com/example/order-service/1.0.0/order-service-1.0.0-stubs.jar
			List<String> segments = splitPath(path);
			if (segments.size() < 3) {
				return null;
			}

			// Last segment is the filename, second-to-last is version, third-to-last is
			// artifactId
			String version = segments.get(segments.size() - 2);
			String artifactId = segments.get(segments.size() - 3);

			// Everything before artifactId is groupId (dot-separated)
			StringBuilder groupId = new StringBuilder();
			for (int i = 0; i < segments.size() - 3; i++) {
				if (i > 0) {
					groupId.append('.');
				}
				groupId.append(segments.get(i));
			}

			if (groupId.isEmpty()) {
				return null;
			}

			return new DiscoveredStub(groupId.toString(), artifactId, version);
		}
		catch (Exception ex) {
			logger.debug("Failed to parse Artifactory URI: {}", uri, ex);
			return null;
		}
	}

	private static List<String> splitPath(String path) {
		List<String> segments = new ArrayList<>();
		int start = 0;
		int idx;
		while ((idx = path.indexOf('/', start)) >= 0) {
			if (idx > start) {
				segments.add(path.substring(start, idx));
			}
			start = idx + 1;
		}
		if (start < path.length()) {
			segments.add(path.substring(start));
		}
		return segments;
	}

	private void validateUrl(String url) {
		URI uri = URI.create(url);
		if (!ALLOWED_SCHEMES.contains(uri.getScheme())) {
			throw new MavenImportException(
					"Invalid repository URL scheme: " + uri.getScheme() + " (only http/https allowed)");
		}
	}

}
