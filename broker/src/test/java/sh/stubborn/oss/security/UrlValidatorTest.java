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
package sh.stubborn.oss.security;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * @see <a href="../../../../../docs/specs/039-data-integrity.md">Spec 039 — Data
 * Integrity</a>
 * @see UrlValidator
 */
class UrlValidatorTest {

	@ParameterizedTest
	@ValueSource(strings = { "https://127.0.0.1/repo", "https://127.0.0.2:8080/path", "http://10.0.0.1/repo",
			"http://10.255.255.255/repo", "https://172.16.0.1/repo", "https://172.31.255.255/repo",
			"https://192.168.1.1/repo", "https://192.168.0.100/path", "http://169.254.1.1/metadata",
			"http://localhost/repo", "http://localhost:8080/path", "http://LOCALHOST/repo", "https://[::1]/repo" })
	void should_block_internal_addresses(String url) {
		assertThatThrownBy(() -> UrlValidator.validateExternalUrl(url)).isInstanceOf(IllegalArgumentException.class)
			.hasMessageContaining("blocked internal address");
	}

	@ParameterizedTest
	@ValueSource(strings = { "https://github.com/owner/repo", "https://repo.maven.apache.org/maven2",
			"https://registry.npmjs.org/package", "http://example.com/artifacts" })
	void should_allow_external_addresses(String url) {
		assertThatCode(() -> UrlValidator.validateExternalUrl(url)).doesNotThrowAnyException();
	}

	@Test
	void should_reject_url_without_host() {
		assertThatThrownBy(() -> UrlValidator.validateExternalUrl("https:///path"))
			.isInstanceOf(IllegalArgumentException.class)
			.hasMessageContaining("no host");
	}

}
