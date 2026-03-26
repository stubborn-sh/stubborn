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

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.dataformat.yaml.YAMLFactory;
import com.fasterxml.jackson.dataformat.yaml.YAMLGenerator;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.cloud.contract.spec.Contract;
import org.springframework.cloud.contract.spec.ContractVerifierException;

import java.io.File;
import java.util.Collection;

class TempYamlToContracts {

	private static final Logger log = LoggerFactory.getLogger(TempYamlToContracts.class);

	private final YamlToContracts yamlToContracts = new YamlToContracts();

	private final ObjectMapper mapper = new ObjectMapper(new YAMLFactory().disable(YAMLGenerator.Feature.SPLIT_LINES)
		.enable(YAMLGenerator.Feature.LITERAL_BLOCK_STYLE));

	TempYamlToContracts() {
		mapper.setSerializationInclusion(JsonInclude.Include.ALWAYS);
	}

	Collection<Contract> convertFromYaml(YamlContract yaml) {
		try {
			File tempFile = File.createTempFile("sccoa3", ".yml");
			mapper.writeValue(tempFile, yaml);
			log.info(tempFile.getAbsolutePath());
			return yamlToContracts.convertFrom(tempFile);
		}
		catch (Exception e) {
			throw new ContractVerifierException("Cannot convert contract %s".formatted(yaml.name), e);
		}
	}

}
