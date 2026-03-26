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

import io.swagger.v3.oas.models.OpenAPI;

import java.util.Map;
import java.util.stream.Stream;

import static org.springframework.cloud.contract.verifier.converter.Oa3Spec.*;
import static org.springframework.cloud.contract.verifier.converter.Utils.*;

class Oa3ToScc {

	private final ServiceNameVerifier serviceNameVerifier = new ServiceNameVerifier();

	Stream<YamlContract> convert(OpenAPI openApi) {
		return openApi.getPaths()
			.entrySet()
			.stream()
			.flatMap(path -> path.getValue()
				.readOperations()
				.stream()
				.filter(operation -> operation.getExtensions() != null
						&& operation.getExtensions().get(X_CONTRACTS) != null)
				.flatMap(operation -> {
					Oa3Spec spec = new Oa3Spec(path.getKey(), path.getValue(), operation);
					return getOrDefault(operation.getExtensions(), X_CONTRACTS, EMPTY_LIST).stream()
						.filter(contracts -> serviceNameVerifier.checkServiceEnabled(get(contracts, SERVICE_NAME)))
						.map(contracts -> getYamlContract(spec, contracts));
				}));
	}

	private YamlContract getYamlContract(Oa3Spec spec, Map<String, Object> contract) {
		Object contractId = get(contract, CONTRACT_ID);
		YamlContract yaml = new YamlContract();
		yaml.name = get(contract, NAME);
		yaml.description = get(contract, DESCRIPTION);
		yaml.priority = get(contract, PRIORITY);
		yaml.label = get(contract, LABEL);
		yaml.ignored = getOrDefault(contract, IGNORED, false);
		yaml.request = new Oa3ToSccRequest(spec, contractId).convert(contract);
		yaml.response = new Oa3ToSccResponse(spec, contractId).convert();
		return yaml;
	}

}
