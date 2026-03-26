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

import io.swagger.v3.oas.models.Operation;
import io.swagger.v3.oas.models.PathItem;
import io.swagger.v3.oas.models.parameters.Parameter;
import io.swagger.v3.oas.models.parameters.RequestBody;
import io.swagger.v3.oas.models.responses.ApiResponse;

import java.util.List;
import java.util.Map;
import java.util.Optional;

record Oa3Spec(String path, PathItem pathItem, Operation operation) {

	static final String BODY = "body";
	static final String BODY_FROM_FILE = "bodyFromFile";
	static final String BODY_FROM_FILE_AS_BYTES = "bodyFromFileAsBytes";
	static final String COMMAND = "command";
	static final String CONTENT_TYPE = "contentType";
	static final String CONTENT_TYPE_COMMAND = "contentTypeCommand";
	static final String CONTENT_TYPE_HTTP_HEADER = "Content-Type";
	static final String CONTRACT_ID = "contractId";
	static final String CONTRACT_PATH = "contractPath";
	static final String COOKIE = "cookie";
	static final String COOKIES = "cookies";
	static final String DESCRIPTION = "description";
	static final String FILE_CONTENT = "fileContent";
	static final String FILE_CONTENT_AS_BYTES = "fileContentAsBytes";
	static final String FILE_CONTENT_COMMAND = "fileContentCommand";
	static final String FILE_CONTENT_FROM_FILE_AS_BYTES = "fileContentFromFileAsBytes";
	static final String FILE_NAME = "fileName";
	static final String FILE_NAME_COMMAND = "fileNameCommand";
	static final String HEADER = "header";
	static final String HEADERS = "headers";
	static final String IGNORED = "ignored";
	static final String KEY = "key";
	static final String LABEL = "label";
	static final String MATCHERS = "matchers";
	static final String MAX_OCCURRENCE = "maxOccurrence";
	static final String MIN_OCCURRENCE = "minOccurrence";
	static final String MULTIPART = "multipart";
	static final String NAME = "name";
	static final String NAMED = "named";
	static final String PARAM_NAME = "paramName";
	static final String PARAMS = "params";
	static final String PATH = "path";
	static final String PREDEFINED = "predefined";
	static final String PRIORITY = "priority";
	static final String QUERY = "query";
	static final String QUERY_PARAMETERS = "queryParameters";
	static final String REGEX = "regex";
	static final String REGEX_TYPE = "regexType";
	static final String REQUEST = "request";
	static final String SERVICE_NAME = "serviceName";
	static final String TYPE = "type";
	static final String URL = "url";
	static final String VALUE = "value";
	static final String X_CONTRACTS = "x-contracts";

	List<Parameter> operationParameters() {
		return operation.getParameters() != null ? operation.getParameters() : List.of();
	}

	RequestBody operationRequestBody() {
		return operation.getRequestBody() != null ? operation.getRequestBody() : new RequestBody();
	}

	Map<String, ApiResponse> operationResponse() {
		return operation.getResponses() != null ? operation.getResponses() : Map.of();
	}

	Optional<String> requestContentType() {
		return Optional.ofNullable(operation().getRequestBody())
			.map(RequestBody::getContent)
			.map(Map::keySet)
			.flatMap(keys -> keys.stream().findFirst());
	}

	String httpMethod() {
		if (operation().equals(pathItem().getGet())) {
			return "GET";
		}
		else if (operation().equals(pathItem().getPut())) {
			return "PUT";
		}
		else if (operation().equals(pathItem().getPost())) {
			return "POST";
		}
		else if (operation().equals(pathItem().getDelete())) {
			return "DELETE";
		}
		else if (operation().equals(pathItem().getPatch())) {
			return "PATCH";
		}
		return null;
	}
}
