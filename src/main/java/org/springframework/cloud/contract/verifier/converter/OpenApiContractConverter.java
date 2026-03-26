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

package org.springframework.cloud.contract.verifier.converter;

import io.swagger.v3.oas.models.PathItem;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.cloud.contract.spec.Contract;
import org.springframework.cloud.contract.spec.ContractConverter;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileReader;
import java.io.IOException;
import java.util.Collection;
import java.util.List;
import java.util.Objects;

public class OpenApiContractConverter implements ContractConverter<Collection<PathItem>> {

	private static final Logger log = LoggerFactory.getLogger(OpenApiContractConverter.class);

	private final TempYamlToContracts tempYamlToContracts = new TempYamlToContracts();

	private final Oa3ToScc oa3ToScc = new Oa3ToScc();

	private final Oa3Parser oa3Parser = new Oa3Parser();

	@Override
	public boolean isAccepted(File file) {
		String name = file.getName().toLowerCase();
		if (!name.endsWith(".yml") && !name.endsWith(".yaml") && !name.endsWith(".json")) {
			return false;
		}
		if (!looksLikeOpenApi(file)) {
			return false;
		}
		try {
			return oa3ToScc.convert(oa3Parser.parseOpenAPI(file)).anyMatch(Objects::nonNull);
		}
		catch (Exception e) {
			log.debug("File is not an OpenAPI specification: {}", file.getName());
		}
		return false;
	}

	private boolean looksLikeOpenApi(File file) {
		try (var reader = new BufferedReader(new FileReader(file))) {
			String line;
			while ((line = reader.readLine()) != null) {
				String trimmed = line.trim();
				if (trimmed.isEmpty() || trimmed.startsWith("#")) {
					continue;
				}
				return trimmed.startsWith("openapi") || trimmed.startsWith("swagger")
						|| trimmed.startsWith("\"openapi\"") || trimmed.startsWith("\"swagger\"")
						|| trimmed.startsWith("{");
			}
		}
		catch (IOException e) {
			// Cannot read file — not OpenAPI
		}
		return false;
	}

	@Override
	public Collection<Contract> convertFrom(File file) {
		try {
			return oa3ToScc.convert(oa3Parser.parseOpenAPI(file))
				.map(tempYamlToContracts::convertFromYaml)
				.flatMap(Collection::stream)
				.toList();
		}
		catch (Exception e) {
			log.error("Error converting OpenAPI file {} to contracts", file.getAbsolutePath(), e);
			return List.of();
		}
	}

	@Override
	public Collection<PathItem> convertTo(Collection<Contract> pathItems) {
		throw new UnsupportedOperationException("Cannot convert contracts into oa3");
	}

}
