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
package sh.stubborn.broker.stubdownloader;

import java.io.File;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.AbstractMap;
import java.util.Collection;
import java.util.List;
import java.util.Map;

import com.github.tomakehurst.wiremock.common.Json;
import com.github.tomakehurst.wiremock.stubbing.StubMapping;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.ObjectMapper;
import org.jspecify.annotations.Nullable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import org.springframework.cloud.contract.spec.Contract;
import org.springframework.cloud.contract.stubrunner.StubConfiguration;
import org.springframework.cloud.contract.stubrunner.StubDownloader;
import org.springframework.cloud.contract.stubrunner.StubRunnerOptions;
import org.springframework.cloud.contract.verifier.converter.YamlContractConverter;
import org.springframework.cloud.contract.verifier.dsl.wiremock.WireMockStubStrategy;
import org.springframework.cloud.contract.verifier.file.ContractMetadata;
import org.springframework.http.HttpStatusCode;
import org.springframework.web.client.RestClient;

/**
 * Downloads contracts from the SCC Broker REST API and writes them to a temp directory
 * structured as the SCC stub runner expects ({@code contracts/} and {@code mappings/}
 * subdirectories).
 */
class BrokerStubDownloader implements StubDownloader {

	private static final Logger log = LoggerFactory.getLogger(BrokerStubDownloader.class);

	private final RestClient restClient;

	private final ObjectMapper objectMapper;

	BrokerStubDownloader(StubRunnerOptions options, BrokerResource resource) {
		RestClient.Builder builder = RestClient.builder().baseUrl(resource.getBrokerUrl());
		String username = resolveCredential(options, "username");
		String password = resolveCredential(options, "password");
		if (username != null && password != null) {
			log.info("Authenticating to broker as '{}'", username);
			builder.defaultHeaders(headers -> headers.setBasicAuth(username, password));
		}
		else {
			log.warn("No broker credentials configured — requests will be unauthenticated");
		}
		builder.defaultStatusHandler(HttpStatusCode::isError, (req, res) -> {
			log.error("Broker API error: {} {} for {}", res.getStatusCode(), res.getStatusText(), req.getURI());
		});
		this.restClient = builder.build();
		this.objectMapper = new ObjectMapper();
	}

	@Override
	@SuppressWarnings("unchecked")
	public Map.@Nullable Entry<StubConfiguration, File> downloadAndUnpackStubJar(StubConfiguration config) {
		String appName = config.getArtifactId();
		String version = resolveVersion(config);
		if (version == null) {
			log.warn("Could not resolve version for {}", appName);
			return null;
		}
		log.info("Downloading contracts from broker for {}:{}", appName, version);
		String json = this.restClient.get()
			.uri("/api/v1/applications/{app}/versions/{ver}/contracts", appName, version)
			.retrieve()
			.body(String.class);
		if (json == null || json.isBlank()) {
			log.warn("No contracts found for {}:{}", appName, version);
			return null;
		}
		List<Map<String, Object>> contracts;
		try {
			Map<String, Object> page = this.objectMapper.readValue(json, Map.class);
			Object content = page.get("content");
			if (!(content instanceof List)) {
				log.error("Unexpected response format from broker (missing 'content' field): {}", json);
				throw new IllegalStateException("Broker returned unexpected response format: " + json);
			}
			contracts = (List<Map<String, Object>>) content;
		}
		catch (JacksonException ex) {
			log.error("Failed to parse contracts JSON from broker (response was: {})", json, ex);
			throw new IllegalStateException("Broker returned invalid JSON for contracts: " + json, ex);
		}
		if (contracts.isEmpty()) {
			log.warn("Empty contracts list for {}:{}", appName, version);
			return null;
		}
		try {
			Path tempDir = Files.createTempDirectory("broker-stubs-" + appName + "-" + version);
			Path contractsDir = tempDir.resolve("contracts");
			Files.createDirectories(contractsDir);
			Path mappingsDir = tempDir.resolve("mappings");
			Files.createDirectories(mappingsDir);
			for (Map<String, Object> contract : contracts) {
				String name = (String) contract.get("contractName");
				String content = (String) contract.get("content");
				if (name != null && content != null) {
					String yamlFileName = name.endsWith(".yaml") || name.endsWith(".yml") || name.endsWith(".groovy")
							? name : name + ".yaml";
					Path contractFile = contractsDir.resolve(yamlFileName);
					Files.writeString(contractFile, content, StandardCharsets.UTF_8);
					convertToWireMockMapping(contractFile, name, mappingsDir);
				}
			}
			StubConfiguration resolved = new StubConfiguration(config.getGroupId(), config.getArtifactId(), version,
					config.getClassifier());
			log.info("Downloaded {} contracts to {}", contracts.size(), tempDir);
			return new AbstractMap.SimpleEntry<>(resolved, tempDir.toFile());
		}
		catch (IOException ex) {
			throw new IllegalStateException("Failed to write contracts to temp directory", ex);
		}
	}

	/**
	 * Converts a YAML contract file to a WireMock JSON mapping and writes it to the
	 * mappings directory. Uses SCC's {@link YamlContractConverter} and
	 * {@link WireMockStubStrategy} for the conversion.
	 */
	private static void convertToWireMockMapping(Path contractFile, String contractName, Path mappingsDir) {
		try {
			Collection<Contract> parsed = YamlContractConverter.INSTANCE.convertFrom(contractFile.toFile());
			int index = 0;
			for (Contract contract : parsed) {
				ContractMetadata metadata = new ContractMetadata(contractFile, false, 1, null, contract);
				WireMockStubStrategy strategy = new WireMockStubStrategy(contractName, metadata, contract);
				StubMapping mapping = strategy.toWireMockClientStub();
				if (mapping != null) {
					String jsonFileName = parsed.size() == 1 ? contractName + ".json"
							: contractName + "_" + index + ".json";
					Files.writeString(mappingsDir.resolve(jsonFileName), Json.write(mapping), StandardCharsets.UTF_8);
				}
				index++;
			}
		}
		catch (Exception ex) {
			log.warn("Failed to convert contract {} to WireMock mapping", contractName, ex);
		}
	}

	/**
	 * Resolves a credential (username or password) from StubRunnerOptions. Checks
	 * options.getUsername()/getPassword() first, then falls back to the properties map
	 * with keys like {@code spring.cloud.contract.stubrunner.username} or
	 * {@code stubrunner.username}.
	 */
	private static @Nullable String resolveCredential(StubRunnerOptions options, String key) {
		String value = "username".equals(key) ? options.getUsername() : options.getPassword();
		if (value != null) {
			return value;
		}
		Map<String, String> props = options.getProperties();
		if (props == null) {
			return null;
		}
		value = props.get("spring.cloud.contract.stubrunner." + key);
		if (value != null) {
			return value;
		}
		return props.get("stubrunner." + key);
	}

	@SuppressWarnings("unchecked")
	private @Nullable String resolveVersion(StubConfiguration config) {
		if (!config.isVersionChanging()) {
			return config.getVersion();
		}
		log.info("Resolving latest version for {} from broker", config.getArtifactId());
		String json = this.restClient.get()
			.uri("/api/v1/applications/{app}", config.getArtifactId())
			.retrieve()
			.body(String.class);
		if (json == null) {
			return null;
		}
		try {
			Map<String, Object> app = this.objectMapper.readValue(json, Map.class);
			Object latestVersion = app.get("latestVersion");
			return latestVersion != null ? latestVersion.toString() : null;
		}
		catch (JacksonException ex) {
			log.warn("Failed to resolve latest version for {}", config.getArtifactId(), ex);
			return null;
		}
	}

}
