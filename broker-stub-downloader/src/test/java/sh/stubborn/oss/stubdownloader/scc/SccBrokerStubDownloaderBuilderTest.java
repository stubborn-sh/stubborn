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
package sh.stubborn.oss.stubdownloader.scc;

import java.util.Objects;

import org.jspecify.annotations.Nullable;
import org.junit.jupiter.api.Test;

import org.springframework.core.io.Resource;
import org.springframework.core.io.ResourceLoader;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

/**
 * Verifies the Spring Cloud Contract 5.x backward-compatibility builder still resolves
 * broker locations, so consumers on SCC 5.x keep working.
 */
class SccBrokerStubDownloaderBuilderTest {

	private final SccBrokerStubDownloaderBuilder builder = new SccBrokerStubDownloaderBuilder();

	private final ResourceLoader resourceLoader = mock(ResourceLoader.class);

	@Test
	void should_resolve_stubborn_protocol() {
		// when
		@Nullable Resource resource = this.builder.resolve("stubborn://http://localhost:18080", this.resourceLoader);

		// then
		assertThat(resource).isNotNull().isInstanceOf(SccBrokerResource.class);
		SccBrokerResource brokerResource = (SccBrokerResource) Objects.requireNonNull(resource);
		assertThat(brokerResource.getBrokerUrl()).isEqualTo("http://localhost:18080");
	}

	@Test
	void should_resolve_legacy_sccbroker_protocol() {
		// when
		@Nullable Resource resource = this.builder.resolve("sccbroker://http://localhost:18080", this.resourceLoader);

		// then
		assertThat(resource).isNotNull().isInstanceOf(SccBrokerResource.class);
		SccBrokerResource brokerResource = (SccBrokerResource) Objects.requireNonNull(resource);
		assertThat(brokerResource.getBrokerUrl()).isEqualTo("http://localhost:18080");
	}

	@Test
	void should_return_null_for_non_broker_protocol() {
		// when
		@Nullable Resource resource = this.builder.resolve("https://repo.example.com/stubs", this.resourceLoader);

		// then
		assertThat(resource).isNull();
	}

	@Test
	void should_return_null_for_empty_location() {
		// when
		@Nullable Resource resource = this.builder.resolve("", this.resourceLoader);

		// then
		assertThat(resource).isNull();
	}

}
