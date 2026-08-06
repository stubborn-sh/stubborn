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
package sh.stubborn.oss.contract;

import java.util.Locale;
import java.util.Set;

import org.jspecify.annotations.Nullable;

/**
 * Single source of truth for the contract content types that the broker recognizes as the
 * YAML contract format.
 * <p>
 * Both the historical Spring Cloud Contract content type
 * ({@value #SPRING_CLOUD_CONTRACT_YAML}) and the Stubborn-native content type
 * ({@value #STUBBORN_YAML}) describe the exact same underlying YAML contract format and
 * are parsed, analyzed, stored and served identically. The Spring Cloud Contract content
 * type is retained unchanged for backward compatibility; the Stubborn content type is an
 * additional accepted alias.
 * <p>
 * The broker stores the client-supplied content type verbatim and does not reject unknown
 * values (other importers legitimately use {@code application/x-yaml},
 * {@code application/json}, etc.), so this class is intentionally an alias set rather
 * than an allow-list.
 */
final class ContractContentTypes {

	/**
	 * Historical Spring Cloud Contract YAML content type. Retained unchanged for backward
	 * compatibility.
	 */
	static final String SPRING_CLOUD_CONTRACT_YAML = "application/x-spring-cloud-contract+yaml";

	/**
	 * Stubborn-native YAML content type. Accepted as an additional alias, equivalent to
	 * {@link #SPRING_CLOUD_CONTRACT_YAML}.
	 */
	static final String STUBBORN_YAML = "application/x-stubborn+yaml";

	/**
	 * The set of content types recognized as the YAML contract format. Every member is
	 * analyzed identically.
	 */
	static final Set<String> YAML = Set.of(SPRING_CLOUD_CONTRACT_YAML, STUBBORN_YAML);

	private ContractContentTypes() {
	}

	/**
	 * Returns whether the given content type is a recognized YAML contract content type
	 * (either the Spring Cloud Contract or the Stubborn-native alias). Matching is
	 * case-insensitive; {@code null} is not recognized.
	 * @param contentType the content type to test, may be {@code null}
	 * @return {@code true} if the content type is a recognized YAML alias
	 */
	static boolean isYaml(@Nullable String contentType) {
		return contentType != null && YAML.contains(contentType.toLowerCase(Locale.ROOT));
	}

}
