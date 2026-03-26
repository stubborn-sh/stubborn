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

import io.swagger.v3.oas.models.OpenAPI;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

class OpenApiSpecIndex {

	private final Map<String, Map<String, Set<String>>> responsesByPath;

	private OpenApiSpecIndex(Map<String, Map<String, Set<String>>> responsesByPath) {
		this.responsesByPath = responsesByPath;
	}

	static OpenApiSpecIndex from(OpenAPI openAPI) {
		Map<String, Map<String, Set<String>>> responses = new LinkedHashMap<>();
		openAPI.getPaths().forEach((path, pathItem) -> {
			Map<String, Set<String>> operations = new LinkedHashMap<>();
			if (pathItem != null) {
				pathItem.readOperationsMap().forEach((method, operation) -> {
					if (operation == null || operation.getResponses() == null) {
						operations.put(method.name(), Set.of());
					}
					else {
						operations.put(method.name(), Set.copyOf(operation.getResponses().keySet()));
					}
				});
			}
			responses.put(path, operations);
		});
		return new OpenApiSpecIndex(responses);
	}

	List<String> matchingPaths(String contractPath) {
		return responsesByPath.keySet()
			.stream()
			.filter(specPath -> OpenApiPathMatcher.matches(contractPath, specPath))
			.toList();
	}

	boolean hasMethod(String path, String method) {
		Map<String, Set<String>> operations = responsesByPath.get(path);
		return operations != null && operations.containsKey(method);
	}

	boolean hasResponse(String path, String method, String status) {
		Map<String, Set<String>> operations = responsesByPath.get(path);
		if (operations == null) {
			return false;
		}
		Set<String> statuses = operations.get(method);
		if (statuses == null || statuses.isEmpty()) {
			return false;
		}
		return statuses.stream().anyMatch(response -> matchesResponseStatus(response, status));
	}

	private boolean matchesResponseStatus(String response, String status) {
		if (response == null) {
			return false;
		}
		String normalized = response.trim();
		if ("default".equalsIgnoreCase(normalized)) {
			return true;
		}
		if (normalized.length() == 3 && normalized.endsWith("XX")) {
			return status.startsWith(normalized.substring(0, 1));
		}
		return normalized.equals(status);
	}

}
