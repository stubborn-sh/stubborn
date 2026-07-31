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
package sh.stubborn.oss.stubdownloader;

import java.io.IOException;
import java.io.InputStream;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.Enumeration;
import java.util.List;
import java.util.ServiceLoader;

import org.junit.jupiter.api.Test;

import sh.stubborn.oss.stubdownloader.scc.SccBrokerStubDownloaderBuilder;

import org.springframework.core.io.ResourceLoader;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

/**
 * Backward-compatibility guarantees for the broker stub downloader. Verifies that both
 * discovery mechanisms are wired — the Stubborn Contract {@link java.util.ServiceLoader}
 * SPI and the Spring Cloud Contract 5.x {@code META-INF/spring.factories} SPI — and that
 * both implementations accept the {@code stubborn://} protocol and the legacy
 * {@code sccbroker://} alias.
 */
class StubDownloaderCompatibilityTest {

	@Test
	void stubborn_builder_is_discovered_via_service_loader() {
		// Inspect provider types rather than instantiating every registered builder, so
		// unrelated builders on the classpath cannot make this assertion flaky.
		List<Class<? extends sh.stubborn.contract.stubrunner.StubDownloaderBuilder>> types = ServiceLoader
			.load(sh.stubborn.contract.stubrunner.StubDownloaderBuilder.class)
			.stream()
			.map(ServiceLoader.Provider::type)
			.toList();
		assertThat(types).contains(BrokerStubDownloaderBuilder.class);
	}

	@Test
	void stubborn_builder_is_registered_in_service_file() throws IOException {
		String services = readClasspathResources(
				"META-INF/services/sh.stubborn.contract.stubrunner.StubDownloaderBuilder");
		assertThat(services).contains("sh.stubborn.oss.stubdownloader.BrokerStubDownloaderBuilder");
	}

	@Test
	void scc_builder_is_registered_in_spring_factories() throws IOException {
		String factories = readClasspathResources("META-INF/spring.factories");
		assertThat(factories).contains("org.springframework.cloud.contract.stubrunner.StubDownloaderBuilder");
		assertThat(factories).contains("sh.stubborn.oss.stubdownloader.scc.SccBrokerStubDownloaderBuilder");
	}

	@Test
	void scc_builder_has_public_no_arg_constructor() {
		// spring.factories discovery instantiates the builder via a public no-arg
		// constructor; this fails to compile/run if that contract is broken.
		assertThat(new SccBrokerStubDownloaderBuilder()).isNotNull();
	}

	@Test
	void both_implementations_accept_stubborn_and_sccbroker_protocols() {
		BrokerStubDownloaderBuilder stubborn = new BrokerStubDownloaderBuilder();
		assertThat(stubborn.resolve("stubborn://http://localhost:18080")).isNotNull();
		assertThat(stubborn.resolve("sccbroker://http://localhost:18080")).isNotNull();

		SccBrokerStubDownloaderBuilder scc = new SccBrokerStubDownloaderBuilder();
		ResourceLoader resourceLoader = mock(ResourceLoader.class);
		assertThat(scc.resolve("stubborn://http://localhost:18080", resourceLoader)).isNotNull();
		assertThat(scc.resolve("sccbroker://http://localhost:18080", resourceLoader)).isNotNull();
	}

	private static String readClasspathResources(String path) throws IOException {
		Enumeration<URL> urls = Thread.currentThread().getContextClassLoader().getResources(path);
		StringBuilder content = new StringBuilder();
		while (urls.hasMoreElements()) {
			URL url = urls.nextElement();
			try (InputStream in = url.openStream()) {
				content.append(new String(in.readAllBytes(), StandardCharsets.UTF_8)).append('\n');
			}
		}
		return content.toString();
	}

}
