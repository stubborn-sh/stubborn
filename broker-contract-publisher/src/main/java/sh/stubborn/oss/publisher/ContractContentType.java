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
package sh.stubborn.oss.publisher;

import java.util.Locale;

import org.jspecify.annotations.Nullable;

/**
 * Maps file extensions to broker contract content types.
 */
final class ContractContentType {

	static final String YAML = "application/x-spring-cloud-contract+yaml";

	static final String GROOVY = "application/x-spring-cloud-contract+groovy";

	static final String JSON = "application/json";

	private ContractContentType() {
	}

	static @Nullable String fromExtension(String filename) {
		String lower = filename.toLowerCase(Locale.ROOT);
		if (lower.endsWith(".yaml") || lower.endsWith(".yml")) {
			return YAML;
		}
		if (lower.endsWith(".groovy")) {
			return GROOVY;
		}
		if (lower.endsWith(".json")) {
			return JSON;
		}
		return null;
	}

	static String stripExtension(String filename) {
		int dot = filename.lastIndexOf('.');
		return (dot > 0) ? filename.substring(0, dot) : filename;
	}

}
