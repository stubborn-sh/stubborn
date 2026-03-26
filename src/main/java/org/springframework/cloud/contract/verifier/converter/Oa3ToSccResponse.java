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

import org.springframework.cloud.contract.verifier.converter.YamlContract.BodyTestMatcher;
import org.springframework.cloud.contract.verifier.converter.YamlContract.TestCookieMatcher;
import org.springframework.cloud.contract.verifier.converter.YamlContract.TestHeaderMatcher;
import org.springframework.cloud.contract.verifier.converter.YamlContract.TestMatcherType;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.apache.commons.lang3.StringUtils.isNotEmpty;
import static org.springframework.cloud.contract.verifier.converter.Oa3Spec.*;
import static org.springframework.cloud.contract.verifier.converter.SccUtils.createPredefinedRegex;
import static org.springframework.cloud.contract.verifier.converter.SccUtils.createRegexType;
import static org.springframework.cloud.contract.verifier.converter.Utils.*;

class Oa3ToSccResponse {

	private final Oa3Spec spec;

	private final Object contractId;

	Oa3ToSccResponse(Oa3Spec spec, Object contractId) {
		this.spec = spec;
		this.contractId = contractId;
	}

	YamlContract.Response convert() {
		YamlContract.Response yamlResponse = new YamlContract.Response();
		spec.operationResponse().forEach((key, value) -> {
			Map<String, Object> contracts = xContracts(value.getExtensions(), contractId);
			if (!contracts.isEmpty()) {
				// response basic
				yamlResponse.status = Integer.parseInt(key.replaceAll("[^a-zA-Z0-9 ]+", ""));
				yamlResponse.body = get(contracts, "body");
				yamlResponse.bodyFromFile = get(contracts, "bodyFromFile");
				yamlResponse.bodyFromFileAsBytes = get(contracts, "bodyFromFileAsBytes");

				// response headers
				Optional.ofNullable(value.getContent())
					.map(Map::keySet)
					.flatMap(keys -> keys.stream().findFirst())
					.ifPresent(contentType -> yamlResponse.headers.put("Content-Type", contentType));
				yamlResponse.headers.putAll(getOrDefault(contracts, "headers", EMPTY_MAP));

				// matchers
				convertMatchers(getOrDefault(contracts, "matchers", EMPTY_MAP), yamlResponse);
			}
		});
		return yamlResponse;
	}

	private void convertMatchers(Map<String, Object> responseMatchers, YamlContract.Response response) {
		// response body matchers
		List<BodyTestMatcher> responseBodyTestMatchers = getOrDefault(responseMatchers, BODY, EMPTY_LIST).stream()
			.map(this::buildBodyTestMatcher)
			.toList();
		response.matchers.body.addAll(responseBodyTestMatchers);

		// response header matchers
		List<TestHeaderMatcher> responseHeaderTestMatchers = getOrDefault(responseMatchers, HEADERS, EMPTY_LIST)
			.stream()
			.map(this::buildTestHeaderMatchers)
			.toList();
		response.matchers.headers.addAll(responseHeaderTestMatchers);

		// response cookies matchers
		List<TestCookieMatcher> responseCookieTestMatchers = getOrDefault(responseMatchers, COOKIES, EMPTY_LIST)
			.stream()
			.map(this::buildTestCookieMatchers)
			.toList();
		response.matchers.cookies.addAll(responseCookieTestMatchers);
	}

	private Map<String, Object> xContracts(Map<String, Object> spec, Object contractId) {
		return getOrDefault(spec, X_CONTRACTS, EMPTY_LIST).stream()
			.filter(contract -> contractId.equals(get(contract, CONTRACT_ID)))
			.findFirst()
			.orElse(Map.of());
	}

	private TestHeaderMatcher buildTestHeaderMatchers(Map<String, Object> matcher) {
		TestHeaderMatcher headersMatcher = new TestHeaderMatcher();
		headersMatcher.key = get(matcher, KEY);
		headersMatcher.regex = get(matcher, REGEX);
		headersMatcher.predefined = createPredefinedRegex(get(matcher, PREDEFINED));
		headersMatcher.command = get(matcher, COMMAND);
		headersMatcher.regexType = createRegexType(get(matcher, REGEX_TYPE));
		return headersMatcher;
	}

	private TestCookieMatcher buildTestCookieMatchers(Map<String, Object> matcher) {
		TestCookieMatcher testCookieMatcher = new TestCookieMatcher();
		testCookieMatcher.key = get(matcher, KEY);
		testCookieMatcher.regex = get(matcher, REGEX);
		testCookieMatcher.predefined = createPredefinedRegex(get(matcher, PREDEFINED));
		testCookieMatcher.command = get(matcher, COMMAND);
		testCookieMatcher.regexType = createRegexType(get(matcher, REGEX_TYPE));
		return testCookieMatcher;
	}

	private BodyTestMatcher buildBodyTestMatcher(Map<String, Object> bodyMatchers) {
		BodyTestMatcher bodyStubMatcher = new BodyTestMatcher();
		bodyStubMatcher.path = get(bodyMatchers, PATH);
		bodyStubMatcher.value = get(bodyMatchers, VALUE);
		bodyStubMatcher.predefined = createPredefinedRegex(get(bodyMatchers, PREDEFINED));
		bodyStubMatcher.minOccurrence = get(bodyMatchers, MIN_OCCURRENCE);
		bodyStubMatcher.maxOccurrence = get(bodyMatchers, MAX_OCCURRENCE);
		bodyStubMatcher.regexType = createRegexType(get(bodyMatchers, REGEX_TYPE));
		if (isNotEmpty(get(bodyMatchers, TYPE))) {
			bodyStubMatcher.type = TestMatcherType.valueOf(get(bodyMatchers, TYPE));
		}
		return bodyStubMatcher;
	}

}
