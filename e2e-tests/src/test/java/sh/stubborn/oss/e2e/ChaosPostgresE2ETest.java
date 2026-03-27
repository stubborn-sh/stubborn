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

import java.time.Duration;
import java.util.Map;

import com.microsoft.playwright.APIRequest;
import com.microsoft.playwright.APIRequestContext;
import com.microsoft.playwright.APIResponse;
import com.microsoft.playwright.Playwright;
import com.microsoft.playwright.options.RequestOptions;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.junit.jupiter.api.TestMethodOrder;
import org.testcontainers.DockerClientFactory;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.Network;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.containers.wait.strategy.HttpWaitStrategy;

import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;

/**
 * Chaos E2E test proving the broker's database circuit breaker works under failure
 * conditions. Pauses the PostgreSQL container to simulate a network partition, verifies
 * the circuit breaker opens (503), then unpauses and verifies recovery.
 *
 * <p>
 * Uses its own containers (not SharedContainers) for isolation.
 *
 * @see <a href="../../../docs/specs/033-chaos-testing.md">Spec 033 — Chaos Testing</a>
 */
@Tag("chaos")
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class ChaosPostgresE2ETest {

	private static final String AUTH_HEADER = "Basic "
			+ java.util.Base64.getEncoder().encodeToString("admin:admin".getBytes());

	private static final String APP_NAME = "chaos-pg-producer";

	private Network network;

	private PostgreSQLContainer<?> postgres;

	private GenericContainer<?> broker;

	private Playwright playwright;

	private APIRequestContext api;

	private String brokerUrl;

	@BeforeAll
	void setUp() {
		this.network = Network.newNetwork();

		this.postgres = new PostgreSQLContainer<>("postgres:16-alpine").withNetwork(this.network)
			.withNetworkAliases("postgres")
			.withDatabaseName("broker")
			.withUsername("broker")
			.withPassword("broker");
		this.postgres.start();

		this.broker = new GenericContainer<>("mgrzejszczak/stubborn:0.1.0-SNAPSHOT").withNetwork(this.network)
			.withExposedPorts(8642)
			.withEnv("DATABASE_URL", "jdbc:postgresql://postgres:5432/broker")
			.withEnv("DATABASE_USERNAME", "broker")
			.withEnv("DATABASE_PASSWORD", "broker")
			.withEnv("OTEL_METRICS_ENABLED", "false")
			// Tighten circuit breaker for faster test execution
			.withEnv("RESILIENCE4J_CIRCUITBREAKER_INSTANCES_DATABASE_SLIDINGWINDOWSIZE", "5")
			.withEnv("RESILIENCE4J_CIRCUITBREAKER_INSTANCES_DATABASE_MINIMUMNUMBEROFCALLS", "3")
			.withEnv("RESILIENCE4J_CIRCUITBREAKER_INSTANCES_DATABASE_FAILURERATETHRESHOLD", "50")
			.withEnv("RESILIENCE4J_CIRCUITBREAKER_INSTANCES_DATABASE_WAITDURATIONINOPENSTATE", "10s")
			.withEnv("RESILIENCE4J_CIRCUITBREAKER_INSTANCES_DATABASE_PERMITTEDNUMBEROFCALLSINHALFOPENSTATE", "3")
			.withEnv("RESILIENCE4J_CIRCUITBREAKER_INSTANCES_DATABASE_AUTOMATICTRANSITIONFROMOPENTOHALFOPENENABLED",
					"true")
			.waitingFor(new HttpWaitStrategy().forPath("/actuator/health")
				.forPort(8642)
				.forStatusCode(200)
				.withStartupTimeout(Duration.ofSeconds(120)));
		this.broker.start();

		this.brokerUrl = "http://localhost:" + this.broker.getMappedPort(8642);

		this.playwright = Playwright.create();
		this.api = this.playwright.request()
			.newContext(new APIRequest.NewContextOptions().setBaseURL(this.brokerUrl)
				.setExtraHTTPHeaders(Map.of("Authorization", AUTH_HEADER)));
	}

	@AfterAll
	void tearDown() {
		// Always try to unpause postgres in case a test failed mid-way
		tryUnpausePostgres();
		if (this.api != null) {
			this.api.dispose();
		}
		if (this.playwright != null) {
			this.playwright.close();
		}
		if (this.broker != null) {
			this.broker.stop();
		}
		if (this.postgres != null) {
			this.postgres.stop();
		}
		if (this.network != null) {
			this.network.close();
		}
	}

	@Test
	@Order(1)
	void should_serve_requests_when_database_is_healthy() {
		// given — register an application to seed data
		APIResponse postResponse = this.api.post("/api/v1/applications",
				RequestOptions.create()
					.setHeader("Content-Type", "application/json")
					.setData(Map.of("name", APP_NAME, "description", "Chaos test producer", "owner", "chaos-team")));
		assertThat(postResponse.status()).as("Register app").isIn(200, 201);

		// when — query applications
		APIResponse getResponse = this.api.get("/api/v1/applications");

		// then — healthy response
		assertThat(getResponse.status()).as("Healthy GET /api/v1/applications").isEqualTo(200);
		assertThat(getResponse.text()).contains(APP_NAME);
	}

	@Test
	@Order(2)
	void should_fail_when_database_is_paused() {
		// when — pause PostgreSQL to simulate network partition
		DockerClientFactory.instance().client().pauseContainerCmd(this.postgres.getContainerId()).exec();

		// then — requests that hit the database should fail (500 or 503)
		await().atMost(Duration.ofSeconds(30)).pollInterval(Duration.ofSeconds(1)).untilAsserted(() -> {
			APIResponse response = this.api.get("/api/v1/applications");
			assertThat(response.status()).as("Request while DB paused").isIn(500, 503);
		});
	}

	@Test
	@Order(3)
	void should_open_circuit_breaker_after_repeated_failures() {
		// given — database is still paused from previous test
		// Send enough requests to trip the circuit breaker (minimum-number-of-calls = 3)
		for (int i = 0; i < 6; i++) {
			this.api.get("/api/v1/applications");
		}

		// when — the circuit breaker should now be open
		APIResponse response = this.api.get("/api/v1/applications");

		// then — 503 SERVICE_UNAVAILABLE from circuit breaker
		assertThat(response.status()).as("Circuit breaker should return 503").isEqualTo(503);
		assertThat(response.text()).contains("SERVICE_UNAVAILABLE");
	}

	@Test
	@Order(4)
	void should_recover_after_database_unpause_and_half_open_wait() {
		// given — unpause PostgreSQL
		DockerClientFactory.instance().client().unpauseContainerCmd(this.postgres.getContainerId()).exec();

		// when — wait for circuit breaker to transition to half-open (10s configured)
		// then try requests; the half-open state allows 3 probe calls
		await().atMost(Duration.ofSeconds(60)).pollInterval(Duration.ofSeconds(2)).untilAsserted(() -> {
			APIResponse response = this.api.get("/api/v1/applications");
			assertThat(response.status()).as("Recovery after unpause").isEqualTo(200);
		});

		// Verify data is still intact
		APIResponse finalResponse = this.api.get("/api/v1/applications");
		assertThat(finalResponse.status()).isEqualTo(200);
		assertThat(finalResponse.text()).contains(APP_NAME);
	}

	private void tryUnpausePostgres() {
		if (this.postgres != null && this.postgres.isRunning()) {
			try {
				DockerClientFactory.instance().client().unpauseContainerCmd(this.postgres.getContainerId()).exec();
			}
			catch (Exception ex) {
				// Container may not be paused — ignore
			}
		}
	}

}
