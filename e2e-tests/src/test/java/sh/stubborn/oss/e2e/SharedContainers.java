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
package sh.stubborn.oss.e2e;

import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.Network;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.containers.wait.strategy.HttpWaitStrategy;
import org.testcontainers.containers.wait.strategy.Wait;

/**
 * Static singleton holding shared Docker containers for all parallel E2E test classes.
 * Started once per JVM via class initializer, reused across all test instances.
 */
final class SharedContainers {

	static final Network NETWORK;

	static final PostgreSQLContainer<?> POSTGRES;

	static final GenericContainer<?> BROKER;

	static final GenericContainer<?> WIREMOCK;

	static final String BROKER_URL;

	static final String WIREMOCK_URL;

	/** WireMock URL accessible from within the Docker network (broker can reach this). */
	static final String WIREMOCK_INTERNAL_URL;

	static {
		NETWORK = Network.newNetwork();

		POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine").withNetwork(NETWORK)
			.withNetworkAliases("postgres")
			.withDatabaseName("broker")
			.withUsername("broker")
			.withPassword("broker");
		POSTGRES.start();

		WIREMOCK = new GenericContainer<>("wiremock/wiremock:3.13.0").withNetwork(NETWORK)
			.withNetworkAliases("wiremock")
			.withExposedPorts(8080)
			.withCommand("--verbose")
			.waitingFor(Wait.forHttp("/__admin/mappings").forPort(8080).forStatusCode(200));
		WIREMOCK.start();

		BROKER = new GenericContainer<>("mgrzejszczak/stubborn:0.1.0-SNAPSHOT").withNetwork(NETWORK)
			.withExposedPorts(8642)
			.withEnv("DATABASE_URL", "jdbc:postgresql://postgres:5432/broker")
			.withEnv("DATABASE_USERNAME", "broker")
			.withEnv("DATABASE_PASSWORD", "broker")
			.withEnv("OTEL_METRICS_ENABLED", "false")
			.withEnv("STUBBORN_WEBHOOKS_ALLOW_INSECURE", "true")
			.waitingFor(new HttpWaitStrategy().forPath("/actuator/health")
				.forPort(8642)
				.forStatusCode(200)
				.withStartupTimeout(java.time.Duration.ofSeconds(120)));
		BROKER.start();

		BROKER_URL = "http://localhost:" + BROKER.getMappedPort(8642);
		WIREMOCK_URL = "http://localhost:" + WIREMOCK.getMappedPort(8080);
		WIREMOCK_INTERNAL_URL = "http://wiremock:8080";
	}

	private SharedContainers() {
	}

}
