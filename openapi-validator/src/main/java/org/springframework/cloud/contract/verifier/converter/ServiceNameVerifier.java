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

import org.apache.commons.lang3.StringUtils;

import java.util.Arrays;

class ServiceNameVerifier {

	static final String SERVICE_NAME_KEY = "scc.enabled.service-names";

	boolean checkServiceEnabled(String serviceName) {
		if (StringUtils.isBlank(serviceName) || StringUtils.isBlank(System.getProperty(SERVICE_NAME_KEY))) {
			return true;
		}
		return Arrays.stream(StringUtils.split(System.getProperty(SERVICE_NAME_KEY), ","))
			.map(StringUtils::trim)
			.toList()
			.contains(serviceName);
	}

}
