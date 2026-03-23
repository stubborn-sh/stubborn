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
package sh.stubborn.broker.contract;

import java.util.regex.Pattern;

public record ContractVersion(String value) {

	private static final int MAX_LENGTH = 64;

	private static final Pattern VALID_PATTERN = Pattern
		.compile("^\\d+\\.\\d+\\.\\d+(-[a-zA-Z0-9]([a-zA-Z0-9.\\-]*[a-zA-Z0-9])?)?(\\+[a-zA-Z0-9.\\-]+)?$");

	public ContractVersion {
		if (value == null || value.isBlank()) {
			throw new IllegalArgumentException("Version must not be blank");
		}
		if (value.length() > MAX_LENGTH) {
			throw new IllegalArgumentException(
					"Version must not exceed " + MAX_LENGTH + " characters, got " + value.length());
		}
		if (!VALID_PATTERN.matcher(value).matches()) {
			throw new IllegalArgumentException(
					"Version must follow semantic versioning (e.g., 1.0.0, 2.1.3-SNAPSHOT): " + value);
		}
	}

	public static ContractVersion of(String value) {
		return new ContractVersion(value);
	}

}
