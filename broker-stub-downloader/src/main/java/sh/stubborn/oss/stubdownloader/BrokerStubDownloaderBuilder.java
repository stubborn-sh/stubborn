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

import org.jspecify.annotations.Nullable;

import sh.stubborn.contract.stubrunner.StubDownloader;
import sh.stubborn.contract.stubrunner.StubDownloaderBuilder;
import sh.stubborn.contract.stubrunner.StubResource;
import sh.stubborn.contract.stubrunner.StubRunnerOptions;
import sh.stubborn.contract.stubrunner.StubsMode;

/**
 * Stubborn Contract {@link StubDownloaderBuilder} that handles the {@code stubborn://}
 * protocol (and the legacy {@code sccbroker://} alias). Resolves stubs by fetching
 * contracts from the broker REST API.
 *
 * <p>
 * This builder is discovered through {@link java.util.ServiceLoader} via
 * {@code META-INF/services/sh.stubborn.contract.stubrunner.StubDownloaderBuilder}.
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
 *
 * @see sh.stubborn.oss.stubdownloader.scc.SccBrokerStubDownloaderBuilder for the Spring
 * Cloud Contract 5.x compatibility variant
 */
public class BrokerStubDownloaderBuilder implements StubDownloaderBuilder {

	@Override
	public @Nullable StubResource resolve(String location) {
		if (location == null || location.isBlank() || !BrokerResource.isBrokerLocation(location)) {
			return null;
		}
		return new BrokerResource(location);
	}

	@Override
	public @Nullable StubDownloader build(StubRunnerOptions stubRunnerOptions) {
		if (stubRunnerOptions.getStubsMode() == StubsMode.CLASSPATH) {
			return null;
		}
		StubResource root = stubRunnerOptions.getStubRepositoryRoot();
		if (!(root instanceof BrokerResource brokerResource)) {
			return null;
		}
		return new BrokerStubDownloader(stubRunnerOptions, brokerResource);
	}

}
