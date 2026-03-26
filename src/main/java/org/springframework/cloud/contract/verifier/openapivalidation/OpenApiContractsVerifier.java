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
package org.springframework.cloud.contract.verifier.openapivalidation;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Locale;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.parser.OpenAPIV3Parser;
import org.jspecify.annotations.Nullable;

import org.springframework.cloud.contract.spec.Contract;
import org.springframework.cloud.contract.spec.ContractConverter;
import org.springframework.cloud.contract.verifier.converter.YamlContractConverter;
import org.springframework.core.io.support.SpringFactoriesLoader;

/**
 * Validates Spring Cloud Contract DSL files against an OpenAPI specification. Supports
 * both file-based verification (from directories) and in-memory verification (from
 * strings).
 *
 * @since 5.0.2
 */
public class OpenApiContractsVerifier {

	/**
	 * Verifies contracts from a directory against an OpenAPI specification.
	 * @since 5.0.2
	 */
	public OpenApiVerificationReport verify(Path openApiSpec, Path contractsDir) {
		List<OpenApiContractViolation> violations = new ArrayList<>();

		if (!Files.isRegularFile(openApiSpec)) {
			violations
				.add(new OpenApiContractViolation(openApiSpec, "OpenAPI", "OpenAPI specification file does not exist"));
			return new OpenApiVerificationReport(List.copyOf(violations));
		}
		if (!Files.isDirectory(contractsDir)) {
			violations
				.add(new OpenApiContractViolation(contractsDir, "Contracts", "Contracts directory does not exist"));
			return new OpenApiVerificationReport(List.copyOf(violations));
		}

		OpenAPI openAPI = parseOpenApi(openApiSpec, violations);
		if (openAPI == null) {
			return new OpenApiVerificationReport(List.copyOf(violations));
		}

		OpenApiSpecIndex specIndex = OpenApiSpecIndex.from(openAPI);
		List<ContractSource> contracts = new ContractLoader().load(contractsDir, violations);
		for (ContractSource contractSource : contracts) {
			Contract contract = contractSource.contract();
			if (contract.getIgnored() || contract.getInProgress()) {
				continue;
			}
			validateContract(specIndex, contractSource, violations);
		}

		return new OpenApiVerificationReport(List.copyOf(violations));
	}

	/**
	 * Verifies a single contract YAML string against an OpenAPI specification string.
	 * Used for runtime in-memory validation without requiring files on disk.
	 * @param openApiSpecContent the OpenAPI specification as a YAML or JSON string
	 * @param contractYaml the Spring Cloud Contract YAML content
	 * @return verification report with any violations found
	 * @since 5.0.2
	 */
	public OpenApiVerificationReport verifyInMemory(String openApiSpecContent, String contractYaml) {
		List<OpenApiContractViolation> violations = new ArrayList<>();

		OpenAPI openAPI = parseOpenApiFromString(openApiSpecContent, violations);
		if (openAPI == null) {
			return new OpenApiVerificationReport(List.copyOf(violations));
		}

		OpenApiSpecIndex specIndex = OpenApiSpecIndex.from(openAPI);
		List<Contract> contracts = parseContractYaml(contractYaml, violations);
		Path inMemoryPath = Path.of("in-memory");
		for (int i = 0; i < contracts.size(); i++) {
			Contract contract = contracts.get(i);
			if (contract.getIgnored() || contract.getInProgress()) {
				continue;
			}
			String name = contract.getName();
			if (name == null || name.isBlank()) {
				name = "contract#" + (i + 1);
			}
			validateContract(specIndex, new ContractSource(inMemoryPath, name, contract), violations);
		}

		return new OpenApiVerificationReport(List.copyOf(violations));
	}

	@Nullable private OpenAPI parseOpenApi(Path openApiSpec, List<OpenApiContractViolation> violations) {
		try {
			OpenAPI openAPI = new OpenAPIV3Parser().read(openApiSpec.toString());
			if (openAPI == null || openAPI.getPaths() == null || openAPI.getPaths().isEmpty()) {
				violations.add(new OpenApiContractViolation(openApiSpec, "OpenAPI",
						"OpenAPI specification contains no paths"));
				return null;
			}
			return openAPI;
		}
		catch (Exception ex) {
			violations.add(new OpenApiContractViolation(openApiSpec, "OpenAPI",
					"Failed to read OpenAPI specification: " + ex.getMessage()));
			return null;
		}
	}

	@Nullable private OpenAPI parseOpenApiFromString(String content, List<OpenApiContractViolation> violations) {
		try {
			OpenAPI openAPI = new OpenAPIV3Parser().readContents(content).getOpenAPI();
			if (openAPI == null || openAPI.getPaths() == null || openAPI.getPaths().isEmpty()) {
				violations.add(new OpenApiContractViolation(Path.of("in-memory"), "OpenAPI",
						"OpenAPI specification contains no paths"));
				return null;
			}
			return openAPI;
		}
		catch (Exception ex) {
			violations.add(new OpenApiContractViolation(Path.of("in-memory"), "OpenAPI",
					"Failed to parse OpenAPI specification: " + ex.getMessage()));
			return null;
		}
	}

	private List<Contract> parseContractYaml(String contractYaml, List<OpenApiContractViolation> violations) {
		try {
			Path tempFile = Files.createTempFile("contract-", ".yml");
			try {
				Files.writeString(tempFile, contractYaml);
				YamlContractConverter converter = YamlContractConverter.INSTANCE;
				Collection<Contract> contracts = converter.convertFrom(tempFile.toFile());
				return List.copyOf(contracts);
			}
			finally {
				Files.deleteIfExists(tempFile);
			}
		}
		catch (Exception ex) {
			violations.add(new OpenApiContractViolation(Path.of("in-memory"), "contract",
					"Failed to parse contract YAML: " + ex.getMessage()));
			return List.of();
		}
	}

	private void validateContract(OpenApiSpecIndex specIndex, ContractSource contractSource,
			List<OpenApiContractViolation> violations) {
		Contract contract = contractSource.contract();
		@Nullable String method = ContractDetails.method(contract);
		@Nullable String path = ContractDetails.path(contract);
		@Nullable Integer status = ContractDetails.status(contract);

		if (method == null || path == null || status == null) {
			violations.add(new OpenApiContractViolation(contractSource.path(), contractSource.name(),
					"Contract must define request method, request URL, and response status"));
			return;
		}

		String requestSignature = method + " " + path;
		List<String> matchingPaths = specIndex.matchingPaths(path);
		if (matchingPaths.isEmpty()) {
			violations.add(new OpenApiContractViolation(contractSource.path(), contractSource.name(),
					"No OpenAPI path matches contract request " + requestSignature));
			return;
		}

		boolean methodExists = matchingPaths.stream().anyMatch(specPath -> specIndex.hasMethod(specPath, method));
		if (!methodExists) {
			violations.add(new OpenApiContractViolation(contractSource.path(), contractSource.name(),
					"No OpenAPI operation matches contract request " + requestSignature));
			return;
		}

		String statusCode = status.toString();
		boolean responseExists = matchingPaths.stream()
			.anyMatch(specPath -> specIndex.hasResponse(specPath, method, statusCode));
		if (!responseExists) {
			violations.add(new OpenApiContractViolation(contractSource.path(), contractSource.name(),
					"No OpenAPI response status " + statusCode + " for contract request " + requestSignature));
		}
	}

	private record ContractSource(Path path, String name, Contract contract) {
	}

	private static final class ContractDetails {

		private ContractDetails() {
			throw new AssertionError("Utility class");
		}

		@Nullable private static String method(Contract contract) {
			if (contract.getRequest() == null || contract.getRequest().getMethod() == null) {
				return null;
			}
			@Nullable Object value = ContractValueExtractor.extract(contract.getRequest().getMethod());
			return value != null ? value.toString().toUpperCase(Locale.ROOT) : null;
		}

		@Nullable private static String path(Contract contract) {
			if (contract.getRequest() == null) {
				return null;
			}
			@Nullable Object urlPath = ContractValueExtractor.extract(contract.getRequest().getUrlPath());
			if (urlPath != null) {
				return urlPath.toString();
			}
			@Nullable Object url = ContractValueExtractor.extract(contract.getRequest().getUrl());
			return url != null ? url.toString() : null;
		}

		@Nullable private static Integer status(Contract contract) {
			if (contract.getResponse() == null || contract.getResponse().getStatus() == null) {
				return null;
			}
			@Nullable Object value = ContractValueExtractor.extract(contract.getResponse().getStatus());
			if (value == null) {
				return null;
			}
			if (value instanceof Number number) {
				return number.intValue();
			}
			String asString = value.toString();
			String digits = asString.replaceAll("[^0-9]", "");
			return digits.isEmpty() ? null : Integer.parseInt(digits);
		}

	}

	private static final class ContractLoader {

		@SuppressWarnings("rawtypes")
		private static final List<ContractConverter> CONVERTERS = SpringFactoriesLoader
			.loadFactories(ContractConverter.class, null);

		List<ContractSource> load(Path contractsDir, List<OpenApiContractViolation> violations) {
			List<ContractSource> contracts = new ArrayList<>();
			try (var paths = java.nio.file.Files.walk(contractsDir)) {
				paths.filter(Files::isRegularFile).sorted().forEach(path -> loadContracts(path, contracts, violations));
			}
			catch (Exception ex) {
				violations.add(new OpenApiContractViolation(contractsDir, "Contracts",
						"Failed to scan contracts directory: " + ex.getMessage()));
			}
			return contracts;
		}

		@SuppressWarnings("rawtypes")
		private void loadContracts(Path path, List<ContractSource> contracts,
				List<OpenApiContractViolation> violations) {
			ParseResult result = ContractParser.parse(path);
			if (!result.accepted()) {
				return;
			}
			if (result.errorMessage() != null) {
				violations
					.add(new OpenApiContractViolation(path, path.getFileName().toString(), result.errorMessage()));
				return;
			}
			if (result.contracts().isEmpty()) {
				// Accepted but empty — converter may not support this JDK or file format
				// at runtime.
				// Skip rather than report as violation (e.g., Java contracts on JDK 25+).
				return;
			}
			for (int i = 0; i < result.contracts().size(); i++) {
				Contract contract = result.contracts().get(i);
				String name = contract.getName();
				if (name == null || name.isBlank()) {
					name = path.getFileName().toString() + "#" + (i + 1);
				}
				contracts.add(new ContractSource(path, name, contract));
			}
		}

	}

	private static final class ContractParser {

		private ContractParser() {
			throw new AssertionError("Utility class");
		}

		@SuppressWarnings({ "unchecked", "rawtypes" })
		static ParseResult parse(Path path) {
			boolean accepted = false;
			for (ContractConverter converter : ContractLoader.CONVERTERS) {
				if (converter.isAccepted(path.toFile())) {
					accepted = true;
					try {
						return new ParseResult(true,
								List.copyOf((Collection<Contract>) converter.convertFrom(path.toFile())), null);
					}
					catch (Exception ex) {
						return new ParseResult(true, List.of(), "Failed to parse contract file: " + ex.getMessage());
					}
				}
			}
			return new ParseResult(accepted, List.of(), null);
		}

	}

	private record ParseResult(boolean accepted, List<Contract> contracts, @Nullable String errorMessage) {
	}

	private static final class ContractValueExtractor {

		private ContractValueExtractor() {
			throw new AssertionError("Utility class");
		}

		@Nullable static Object extract(org.springframework.cloud.contract.spec.internal.@Nullable DslProperty<?> property) {
			if (property == null) {
				return null;
			}
			@Nullable Object client = property.getClientValue();
			return client != null ? client : property.getServerValue();
		}

	}

}
