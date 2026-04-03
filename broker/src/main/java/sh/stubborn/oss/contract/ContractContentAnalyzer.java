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
package sh.stubborn.oss.contract;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import org.springframework.cloud.contract.spec.internal.DslProperty;
import org.springframework.cloud.contract.spec.internal.OutputMessage;
import org.springframework.cloud.contract.verifier.converter.YamlContractConverter;
import org.springframework.stereotype.Component;

/**
 * Analyzes contract content using SCC's native {@link YamlContractConverter} to detect
 * whether a contract is HTTP or messaging, and extract topic references.
 */
@Component
class ContractContentAnalyzer {

	private static final Logger log = LoggerFactory.getLogger(ContractContentAnalyzer.class);

	ContractAnalysis analyze(String content, String contentType) {
		if (content == null || content.isBlank()) {
			return ContractAnalysis.HTTP_DEFAULT;
		}
		try {
			Path tempFile = Files.createTempFile("contract-analysis-", ".yaml");
			try {
				Files.writeString(tempFile, content, StandardCharsets.UTF_8);
				Collection<org.springframework.cloud.contract.spec.Contract> contracts = YamlContractConverter.INSTANCE
					.convertFrom(tempFile.toFile());
				return analyzeContracts(contracts);
			}
			finally {
				Files.deleteIfExists(tempFile);
			}
		}
		catch (IOException ex) {
			log.warn("Failed to write temp file for contract analysis", ex);
			return ContractAnalysis.HTTP_DEFAULT;
		}
		catch (Exception ex) {
			log.warn("Failed to parse contract content for interaction type detection", ex);
			return ContractAnalysis.HTTP_DEFAULT;
		}
	}

	private ContractAnalysis analyzeContracts(Collection<org.springframework.cloud.contract.spec.Contract> contracts) {
		List<TopicReference> topics = new ArrayList<>();
		boolean hasMessaging = false;
		for (org.springframework.cloud.contract.spec.Contract contract : contracts) {
			OutputMessage outputMessage = contract.getOutputMessage();
			if (outputMessage != null) {
				DslProperty<String> sentTo = outputMessage.getSentTo();
				if (sentTo != null && sentTo.getClientValue() != null) {
					topics.add(new TopicReference(sentTo.getClientValue().toString(), TopicDirection.PUBLISH));
					hasMessaging = true;
				}
			}
			// Contracts are always publisher-side in SCC.
			// Consumer verification uses Stub Runner, not contracts.
		}
		if (hasMessaging) {
			return new ContractAnalysis(InteractionType.MESSAGING, List.copyOf(topics));
		}
		return ContractAnalysis.HTTP_DEFAULT;
	}

}
