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
package org.springframework.cloud.contract.broker.environment;

import java.util.regex.Pattern;

record EnvironmentName(String value) {

	private static final int MAX_LENGTH = 64;

	private static final Pattern VALID_PATTERN = Pattern.compile("^[a-z0-9]([a-z0-9-]*[a-z0-9])?$");

	EnvironmentName {
		if (value == null || value.isBlank()) {
			throw new IllegalArgumentException("Environment name must not be blank");
		}
		if (value.length() > MAX_LENGTH) {
			throw new IllegalArgumentException(
					"Environment name must not exceed " + MAX_LENGTH + " characters, got " + value.length());
		}
		if (!VALID_PATTERN.matcher(value).matches()) {
			throw new IllegalArgumentException(
					"Environment name must be lowercase alphanumeric with hyphens, no leading/trailing hyphens: "
							+ value);
		}
	}

	static EnvironmentName of(String value) {
		return new EnvironmentName(value);
	}

}
