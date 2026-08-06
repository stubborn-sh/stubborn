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

import org.jspecify.annotations.Nullable;

import org.springframework.cloud.contract.stubrunner.StubDownloader;
import org.springframework.cloud.contract.stubrunner.StubDownloaderBuilder;
import org.springframework.cloud.contract.stubrunner.StubRunnerOptions;
import org.springframework.cloud.contract.stubrunner.spring.StubRunnerProperties;
import org.springframework.core.io.Resource;
import org.springframework.core.io.ResourceLoader;
import org.springframework.util.StringUtils;

/**
 * Spring Cloud Contract 5.x {@link StubDownloaderBuilder} that handles the
 * {@code stubborn://} protocol (and the legacy {@code sccbroker://} alias). Retained so
 * that consumers still on Spring Cloud Contract 5.x can resolve stubs from a Stubborn
 * Broker without changing their dependencies.
 *
 * <p>
 * This builder is discovered through {@code META-INF/spring.factories}. New consumers on
 * Stubborn Contract use
 * {@link sh.stubborn.oss.stubdownloader.BrokerStubDownloaderBuilder} instead, which is
 * discovered through {@link java.util.ServiceLoader}.
 *
 * <p>
 * Usage in consumer tests:
 *
 * <pre>
 * &#64;AutoConfigureStubRunner(
 *     ids = "org.example:order-service:1.0.0:stubs",
 *     repositoryRoot = "stubborn://http://localhost:18080",
 *     stubsMode = StubRunnerProperties.StubsMode.REMOTE
 * )
 * </pre>
 */
public class SccBrokerStubDownloaderBuilder implements StubDownloaderBuilder {

	@Override
	public @Nullable Resource resolve(String location, ResourceLoader resourceLoader) {
		if (!StringUtils.hasText(location) || !SccBrokerResource.isBrokerLocation(location)) {
			return null;
		}
		return new SccBrokerResource(location);
	}

	@Override
	public @Nullable StubDownloader build(StubRunnerOptions stubRunnerOptions) {
		if (stubRunnerOptions.getStubsMode() == StubRunnerProperties.StubsMode.CLASSPATH) {
			return null;
		}
		Resource root = stubRunnerOptions.getStubRepositoryRoot();
		if (!(root instanceof SccBrokerResource brokerResource)) {
			return null;
		}
		return new SccBrokerStubDownloader(stubRunnerOptions, brokerResource);
	}

}
