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
package org.springframework.cloud.contract.broker.application;

import java.util.regex.Pattern;

record ApplicationName(String value) {

	private static final int MAX_LENGTH = 128;

	private static final Pattern VALID_PATTERN = Pattern.compile("^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?$");

	ApplicationName {
		if (value == null || value.isBlank()) {
			throw new IllegalArgumentException("Application name must not be blank");
		}
		if (value.length() > MAX_LENGTH) {
			throw new IllegalArgumentException(
					"Application name must not exceed " + MAX_LENGTH + " characters, got " + value.length());
		}
		if (!VALID_PATTERN.matcher(value).matches()) {
			throw new IllegalArgumentException(
					"Application name must match pattern: alphanumeric and hyphens, no leading/trailing hyphens");
		}
	}

	static ApplicationName of(String value) {
		return new ApplicationName(value);
	}

}
