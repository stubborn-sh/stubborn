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

import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

import static org.apache.commons.lang3.StringUtils.isNotEmpty;
import static org.springframework.cloud.contract.verifier.converter.Oa3Spec.*;
import static org.springframework.cloud.contract.verifier.converter.SccUtils.*;
import static org.springframework.cloud.contract.verifier.converter.Utils.*;

class Oa3ToSccRequest {

	private final Oa3Spec spec;

	private final Object contractId;

	Oa3ToSccRequest(Oa3Spec spec, Object contractId) {
		this.spec = spec;
		this.contractId = contractId;
	}

	YamlContract.Request convert(Map<String, Object> contract) {
		YamlContract.Request yamlRequest = new YamlContract.Request();
		yamlRequest.urlPath = getOrDefault(contract, CONTRACT_PATH, calculatePath());
		yamlRequest.method = spec.httpMethod();

		// request headers
		yamlRequest.headers.putAll(getOrDefault(contract, HEADERS, EMPTY_MAP));
		spec.requestContentType()
			.ifPresent(contentType -> yamlRequest.headers.put(CONTENT_TYPE_HTTP_HEADER, contentType));

		// request query parameters
		Map<String, Object> request = getOrDefault(contract, REQUEST, EMPTY_MAP);
		Map<String, Object> requestQueryParameters = getOrDefault(request, QUERY_PARAMETERS, EMPTY_LIST).stream()
			.collect(Collectors.toMap(entry -> (String) entry.get(KEY), entry -> entry.get(VALUE)));
		yamlRequest.queryParameters.putAll(requestQueryParameters);

		// operation query parameters
		spec.operationParameters()
			.stream()
			.filter(parameter -> !xContracts(parameter.getExtensions(), contractId).isEmpty())
			.filter(parameter -> List.of(PATH, QUERY).contains(parameter.getIn()))
			.forEach(parameter -> {
				Map<String, Object> contractParam = xContracts(parameter.getExtensions(), contractId);
				yamlRequest.queryParameters.put(parameter.getName(), get(contractParam, VALUE));
				getOrDefault(contractParam, MATCHERS, EMPTY_LIST).forEach(matcher -> {
					YamlContract.QueryParameterMatcher queryParameterMatcher = new YamlContract.QueryParameterMatcher();
					queryParameterMatcher.key = parameter.getName();
					queryParameterMatcher.value = get(matcher, VALUE);
					queryParameterMatcher.type = createMatchingType(get(matcher, TYPE));
					yamlRequest.matchers.queryParameters.add(queryParameterMatcher);
				});
			});

		// operation headers
		spec.operationParameters()
			.stream()
			.filter(parameter -> !xContracts(parameter.getExtensions(), contractId).isEmpty())
			.filter(parameter -> Objects.equals(HEADER, parameter.getIn()))
			.forEach(parameter -> {
				Map<String, Object> contractParam = xContracts(parameter.getExtensions(), contractId);
				yamlRequest.headers.put(parameter.getName(), get(contractParam, VALUE));
				List<YamlContract.HeadersMatcher> requestHeaderMatchers = buildHeaderMatchers(
						xContracts(parameter.getExtensions(), contractId), parameter.getName());
				yamlRequest.matchers.headers.addAll(requestHeaderMatchers);
			});

		// operation cookies
		spec.operationParameters()
			.stream()
			.filter(parameter -> !xContracts(parameter.getExtensions(), contractId).isEmpty())
			.filter(parameter -> Objects.equals(COOKIE, parameter.getIn()))
			.forEach(parameter -> {
				Map<String, Object> contractParam = xContracts(parameter.getExtensions(), contractId);
				yamlRequest.cookies.put(parameter.getName(), get(contractParam, VALUE));
			});

		// request body
		Map<String, Object> requestBody = xContracts(spec.operationRequestBody().getExtensions(), contractId);
		yamlRequest.headers.putAll(getOrDefault(requestBody, HEADERS, EMPTY_MAP));
		yamlRequest.cookies.putAll(getOrDefault(requestBody, COOKIES, EMPTY_MAP));
		yamlRequest.queryParameters.putAll(getOrDefault(requestBody, QUERY_PARAMETERS, EMPTY_LIST).stream()
			.collect(Collectors.toMap(entry -> (String) entry.get(KEY), entry -> entry.get(VALUE))));
		yamlRequest.body = get(requestBody, BODY);
		yamlRequest.bodyFromFile = get(requestBody, BODY_FROM_FILE);
		yamlRequest.bodyFromFileAsBytes = get(requestBody, BODY_FROM_FILE_AS_BYTES);

		// request body multipart
		Map<String, Object> requestBodyMultipart = getOrDefault(requestBody, MULTIPART, EMPTY_MAP);
		if (!requestBodyMultipart.isEmpty()) {
			yamlRequest.multipart = new YamlContract.Multipart();
			yamlRequest.matchers.multipart = new YamlContract.MultipartStubMatcher();
			yamlRequest.multipart.params.putAll(getOrDefault(requestBodyMultipart, PARAMS, Map.of()));
			yamlRequest.multipart.named
				.addAll(getOrDefault(requestBodyMultipart, NAMED, EMPTY_LIST).stream().map(contractNamed -> {
					YamlContract.Named named = new YamlContract.Named();
					named.paramName = get(contractNamed, PARAM_NAME);
					named.fileName = get(contractNamed, FILE_NAME);
					named.fileContent = get(contractNamed, FILE_CONTENT);
					named.fileContentAsBytes = get(contractNamed, FILE_CONTENT_AS_BYTES);
					named.fileContentFromFileAsBytes = get(contractNamed, FILE_CONTENT_FROM_FILE_AS_BYTES);
					named.contentType = get(contractNamed, CONTENT_TYPE);
					named.fileNameCommand = get(contractNamed, FILE_NAME_COMMAND);
					named.fileContentCommand = get(contractNamed, FILE_CONTENT_COMMAND);
					named.contentTypeCommand = get(contractNamed, CONTENT_TYPE_COMMAND);
					return named;
				}).toList());
		}

		// matchers
		convertMatchers(getOrDefault(requestBody, MATCHERS, EMPTY_MAP), yamlRequest);

		return yamlRequest;
	}

	private String calculatePath() {
		return spec.operationParameters()
			.stream()
			.filter(parameter -> PATH.equals(parameter.getIn()))
			.reduce(spec.path(), (currentPath, parameter) -> {
				String parameterName = parameter.getName();
				return getOrDefault(parameter.getExtensions(), X_CONTRACTS, EMPTY_LIST).stream()
					.filter(contracts -> contractId.equals(get(contracts, CONTRACT_ID)))
					.map(contracts -> currentPath.replace("{" + parameterName + "}", get(contracts, VALUE)))
					.findFirst()
					.orElse(currentPath);

			}, (p1, p2) -> p1);
	}

	private void convertMatchers(Map<String, Object> matchers, YamlContract.Request request) {
		// request body url matchers
		request.matchers.url = buildKeyValueMatcher(getOrDefault(matchers, URL, EMPTY_MAP));

		// request body headers matchers
		request.matchers.headers
			.addAll(getOrDefault(matchers, HEADERS, EMPTY_LIST).stream().map(this::buildKeyValueMatcher).toList());

		// request body cookies matchers
		request.matchers.cookies
			.addAll(getOrDefault(matchers, COOKIES, EMPTY_LIST).stream().map(this::buildKeyValueMatcher).toList());

		// request body query parameters matchers
		request.matchers.queryParameters
			.addAll(getOrDefault(matchers, QUERY_PARAMETERS, EMPTY_LIST).stream().map(queryParametersMatchers -> {
				YamlContract.QueryParameterMatcher queryParameterMatcher = new YamlContract.QueryParameterMatcher();
				queryParameterMatcher.key = get(queryParametersMatchers, KEY);
				queryParameterMatcher.value = get(queryParametersMatchers, VALUE);
				queryParameterMatcher.type = createMatchingType(get(queryParametersMatchers, TYPE));
				return queryParameterMatcher;
			}).toList());

		// request body matchers
		List<YamlContract.BodyStubMatcher> requestBodyStubMatchers = getOrDefault(matchers, BODY, EMPTY_LIST).stream()
			.map(this::buildBodyStubMatcher)
			.toList();
		request.matchers.body.addAll(requestBodyStubMatchers);

		Map<String, Object> matchersMultipart = getOrDefault(matchers, MULTIPART, EMPTY_MAP);
		if (!matchersMultipart.isEmpty()) {
			// params
			List<YamlContract.KeyValueMatcher> multipartParams = getOrDefault(matchersMultipart, PARAMS, EMPTY_LIST)
				.stream()
				.map(this::buildKeyValueMatcher)
				.toList();
			request.matchers.multipart.params.addAll(multipartParams);

			// named
			var stubMatchers = getOrDefault(matchersMultipart, NAMED, EMPTY_LIST).stream().map(multipartNamed -> {
				YamlContract.MultipartNamedStubMatcher stubMatcher = new YamlContract.MultipartNamedStubMatcher();
				stubMatcher.paramName = get(multipartNamed, PARAM_NAME);
				stubMatcher.fileName = buildValueMatcher(multipartNamed, FILE_NAME);
				stubMatcher.fileContent = buildValueMatcher(multipartNamed, FILE_CONTENT);
				stubMatcher.contentType = buildValueMatcher(multipartNamed, CONTENT_TYPE_HTTP_HEADER);
				return stubMatcher;
			}).toList();
			request.matchers.multipart.named.addAll(stubMatchers);
		}
	}

	private List<YamlContract.HeadersMatcher> buildHeaderMatchers(Map<String, Object> contracts, String name) {
		return getOrDefault(contracts, MATCHERS, EMPTY_LIST).stream().map(matcher -> {
			YamlContract.HeadersMatcher headersMatcher = new YamlContract.HeadersMatcher();
			headersMatcher.key = name;
			headersMatcher.regex = get(matcher, REGEX);
			headersMatcher.predefined = createPredefinedRegex(get(matcher, PREDEFINED));
			headersMatcher.command = get(matcher, COMMAND);
			headersMatcher.regexType = createRegexType(get(matcher, REGEX_TYPE));
			return headersMatcher;
		}).toList();
	}

	private YamlContract.BodyStubMatcher buildBodyStubMatcher(Map<String, Object> bodyMatchers) {
		YamlContract.BodyStubMatcher bodyStubMatcher = new YamlContract.BodyStubMatcher();
		bodyStubMatcher.path = get(bodyMatchers, PATH);
		bodyStubMatcher.value = get(bodyMatchers, VALUE);

		if (isNotEmpty(get(bodyMatchers, TYPE))) {
			bodyStubMatcher.type = YamlContract.StubMatcherType.valueOf(get(bodyMatchers, TYPE));
		}
		bodyStubMatcher.predefined = createPredefinedRegex(get(bodyMatchers, PREDEFINED));
		bodyStubMatcher.minOccurrence = get(bodyMatchers, MIN_OCCURRENCE);
		bodyStubMatcher.maxOccurrence = get(bodyMatchers, MAX_OCCURRENCE);
		bodyStubMatcher.regexType = createRegexType(get(bodyMatchers, REGEX_TYPE));
		return bodyStubMatcher;
	}

	private YamlContract.ValueMatcher buildValueMatcher(Map<String, Object> matcher, String key) {
		Map<String, Object> map = getOrDefault(matcher, key, EMPTY_MAP);
		if (map.isEmpty()) {
			return null;
		}
		YamlContract.ValueMatcher valueMatcher = new YamlContract.ValueMatcher();
		valueMatcher.regex = getOrDefault(map, REGEX, null);
		valueMatcher.predefined = createPredefinedRegex(get(map, PREDEFINED));
		return valueMatcher;
	}

	private YamlContract.KeyValueMatcher buildKeyValueMatcher(Map<String, Object> matcher) {
		YamlContract.KeyValueMatcher keyValueMatcher = new YamlContract.KeyValueMatcher();
		keyValueMatcher.key = get(matcher, KEY);
		keyValueMatcher.regex = get(matcher, REGEX);
		keyValueMatcher.command = get(matcher, COMMAND);
		keyValueMatcher.predefined = createPredefinedRegex(get(matcher, PREDEFINED));
		keyValueMatcher.regexType = createRegexType(get(matcher, REGEX_TYPE));
		return keyValueMatcher;
	}

	private Map<String, Object> xContracts(Map<String, Object> spec, Object contractId) {
		return getOrDefault(spec, X_CONTRACTS, EMPTY_LIST).stream()
			.filter(contract -> contractId.equals(get(contract, CONTRACT_ID)))
			.findFirst()
			.orElse(Map.of());
	}

}
