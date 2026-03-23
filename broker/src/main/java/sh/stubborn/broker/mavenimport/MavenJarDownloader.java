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
package sh.stubborn.broker.mavenimport;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.net.URI;
import java.util.ArrayList;
import java.util.List;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

import org.jspecify.annotations.Nullable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

@Component
class MavenJarDownloader {

	private static final Logger logger = LoggerFactory.getLogger(MavenJarDownloader.class);

	private static final int MAX_JAR_SIZE = 50 * 1024 * 1024; // 50 MB

	private static final int MAX_ENTRY_SIZE = 1024 * 1024; // 1 MB per entry

	private static final List<String> ALLOWED_SCHEMES = List.of("http", "https");

	private final RestClient restClient;

	MavenJarDownloader(RestClient.Builder restClientBuilder) {
		this.restClient = restClientBuilder.build();
	}

	List<ExtractedContract> downloadAndExtract(String repositoryUrl, String groupId, String artifactId, String version,
			@Nullable String username, @Nullable String password) {
		String jarUrl = buildJarUrl(repositoryUrl, groupId, artifactId, version);
		validateUrl(jarUrl);

		logger.info("Downloading stubs JAR from {}", jarUrl);

		RestClient.RequestHeadersSpec<?> request = this.restClient.get().uri(jarUrl);
		if (username != null && password != null) {
			request = request.header("Authorization",
					"Basic " + java.util.Base64.getEncoder().encodeToString((username + ":" + password).getBytes()));
		}

		byte[] jarBytes = request.retrieve().body(byte[].class);

		if (jarBytes == null || jarBytes.length == 0) {
			throw new MavenImportException("Empty response from " + jarUrl);
		}

		if (jarBytes.length > MAX_JAR_SIZE) {
			throw new MavenImportException("JAR exceeds maximum size of " + MAX_JAR_SIZE + " bytes: " + jarUrl);
		}

		logger.info("Downloaded {} bytes, extracting contracts", jarBytes.length);
		return extractContracts(jarBytes);
	}

	private List<ExtractedContract> extractContracts(byte[] jarBytes) {
		List<ExtractedContract> contracts = new ArrayList<>();

		try (ZipInputStream zis = new ZipInputStream(new ByteArrayInputStream(jarBytes))) {
			ZipEntry entry;
			while ((entry = zis.getNextEntry()) != null) {
				if (entry.isDirectory()) {
					continue;
				}

				String name = entry.getName();

				// Look for mappings/ or contracts/ directories (at any nesting level)
				if (!isContractEntry(name)) {
					continue;
				}

				byte[] content = readEntry(zis, entry);
				if (content.length > MAX_ENTRY_SIZE) {
					logger.warn("Skipping oversized entry: {} ({} bytes)", name, content.length);
					continue;
				}

				String contentType = name.endsWith(".json") ? "application/json" : "application/x-yaml";
				String contractName = extractContractName(name);
				contracts.add(new ExtractedContract(contractName,
						new String(content, java.nio.charset.StandardCharsets.UTF_8), contentType));
			}
		}
		catch (IOException ex) {
			throw new MavenImportException("Failed to extract stubs JAR: " + ex.getMessage(), ex);
		}

		return contracts;
	}

	private boolean isContractEntry(String name) {
		// Match files under mappings/ or contracts/ at any depth
		return (name.contains("/mappings/") || name.contains("/contracts/") || name.startsWith("mappings/")
				|| name.startsWith("contracts/"))
				&& (name.endsWith(".json") || name.endsWith(".yaml") || name.endsWith(".yml"));
	}

	private String extractContractName(String fullPath) {
		// Extract relative name after mappings/ or contracts/
		int mappingsIdx = fullPath.lastIndexOf("/mappings/");
		if (mappingsIdx >= 0) {
			return fullPath.substring(mappingsIdx + "/mappings/".length());
		}
		int contractsIdx = fullPath.lastIndexOf("/contracts/");
		if (contractsIdx >= 0) {
			return fullPath.substring(contractsIdx + "/contracts/".length());
		}
		if (fullPath.startsWith("mappings/")) {
			return fullPath.substring("mappings/".length());
		}
		if (fullPath.startsWith("contracts/")) {
			return fullPath.substring("contracts/".length());
		}
		return fullPath;
	}

	private byte[] readEntry(ZipInputStream zis, ZipEntry entry) throws IOException {
		// Read up to MAX_ENTRY_SIZE + 1 to detect oversized entries
		return zis.readNBytes(MAX_ENTRY_SIZE + 1);
	}

	private String buildJarUrl(String repositoryUrl, String groupId, String artifactId, String version) {
		String baseUrl = repositoryUrl.replaceAll("/+$", "");
		String groupPath = groupId.replace('.', '/');
		return baseUrl + "/" + groupPath + "/" + artifactId + "/" + version + "/" + artifactId + "-" + version
				+ "-stubs.jar";
	}

	private void validateUrl(String url) {
		URI uri = URI.create(url);
		if (!ALLOWED_SCHEMES.contains(uri.getScheme())) {
			throw new MavenImportException(
					"Invalid repository URL scheme: " + uri.getScheme() + " (only http/https allowed)");
		}
	}

	record ExtractedContract(String contractName, String content, String contentType) {
	}

}
