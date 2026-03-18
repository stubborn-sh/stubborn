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
package org.springframework.cloud.contract.broker.stubdownloader;

import org.jspecify.annotations.Nullable;

import org.springframework.cloud.contract.stubrunner.StubDownloader;
import org.springframework.cloud.contract.stubrunner.StubDownloaderBuilder;
import org.springframework.cloud.contract.stubrunner.StubRunnerOptions;
import org.springframework.cloud.contract.stubrunner.spring.StubRunnerProperties;
import org.springframework.core.io.Resource;
import org.springframework.core.io.ResourceLoader;
import org.springframework.util.StringUtils;

/**
 * {@link StubDownloaderBuilder} that handles the {@code sccbroker://} protocol. Resolves
 * stubs by fetching contracts from the broker REST API.
 *
 * <p>
 * Usage in consumer tests:
 *
 * <pre>
 * &#64;AutoConfigureStubRunner(
 *     ids = "org.example:order-service:1.0.0:stubs",
 *     repositoryRoot = "sccbroker://http://localhost:18080",
 *     stubsMode = StubRunnerProperties.StubsMode.REMOTE
 * )
 * </pre>
 */
public class BrokerStubDownloaderBuilder implements StubDownloaderBuilder {

	@Override
	public @Nullable Resource resolve(String location, ResourceLoader resourceLoader) {
		if (!StringUtils.hasText(location) || !location.startsWith(BrokerResource.PROTOCOL + "://")) {
			return null;
		}
		return new BrokerResource(location);
	}

	@Override
	public @Nullable StubDownloader build(StubRunnerOptions stubRunnerOptions) {
		if (stubRunnerOptions.getStubsMode() == StubRunnerProperties.StubsMode.CLASSPATH) {
			return null;
		}
		Resource root = stubRunnerOptions.getStubRepositoryRoot();
		if (!(root instanceof BrokerResource)) {
			return null;
		}
		return new BrokerStubDownloader(stubRunnerOptions, (BrokerResource) root);
	}

}
