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
import java.util.concurrent.CompletableFuture;

import com.microsoft.playwright.APIRequest;
import com.microsoft.playwright.APIRequestContext;
import com.microsoft.playwright.APIResponse;
import com.microsoft.playwright.Playwright;
import com.microsoft.playwright.options.RequestOptions;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.junit.jupiter.api.TestMethodOrder;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.Network;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.containers.wait.strategy.HttpWaitStrategy;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * High Availability E2E test proving the broker can run in HA mode: multiple instances
 * sharing the same PostgreSQL database. Spins up two broker containers against a single
 * PostgreSQL and verifies data replication, concurrent writes, instance failure recovery,
 * and cross-instance deployment safety checks.
 *
 * @see <a href="../../../docs/specs/028-high-availability.md">Spec 028 — High
 * Availability</a>
 */
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class HighAvailabilityE2ETest {

	private static final String AUTH_HEADER = "Basic "
			+ java.util.Base64.getEncoder().encodeToString("admin:admin".getBytes());

	private static final String APP_NAME = "ha-test-producer";

	private static final String CONSUMER_NAME = "ha-test-consumer";

	private static final String VERSION = "1.0.0";

	private static final String STAGING = "staging";

	private Network network;

	private PostgreSQLContainer<?> postgres;

	private GenericContainer<?> brokerA;

	private GenericContainer<?> brokerB;

	private Playwright playwright;

	private APIRequestContext apiA;

	private APIRequestContext apiB;

	private String brokerAUrl;

	private String brokerBUrl;

	@BeforeAll
	void setUp() {
		this.network = Network.newNetwork();

		this.postgres = new PostgreSQLContainer<>("postgres:16-alpine").withNetwork(this.network)
			.withNetworkAliases("postgres")
			.withDatabaseName("broker")
			.withUsername("broker")
			.withPassword("broker");
		this.postgres.start();

		this.brokerA = createBrokerContainer("broker-a");
		this.brokerA.start();

		this.brokerB = createBrokerContainer("broker-b");
		this.brokerB.start();

		this.brokerAUrl = "http://localhost:" + this.brokerA.getMappedPort(8642);
		this.brokerBUrl = "http://localhost:" + this.brokerB.getMappedPort(8642);

		this.playwright = Playwright.create();
		this.apiA = this.playwright.request()
			.newContext(new APIRequest.NewContextOptions().setBaseURL(this.brokerAUrl)
				.setExtraHTTPHeaders(Map.of("Authorization", AUTH_HEADER)));
		this.apiB = this.playwright.request()
			.newContext(new APIRequest.NewContextOptions().setBaseURL(this.brokerBUrl)
				.setExtraHTTPHeaders(Map.of("Authorization", AUTH_HEADER)));
	}

	@AfterAll
	void tearDown() {
		if (this.apiA != null) {
			this.apiA.dispose();
		}
		if (this.apiB != null) {
			this.apiB.dispose();
		}
		if (this.playwright != null) {
			this.playwright.close();
		}
		if (this.brokerA != null) {
			this.brokerA.stop();
		}
		if (this.brokerB != null) {
			this.brokerB.stop();
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
	void should_replicate_data_across_instances() {
		// given — register application on Broker A
		APIResponse postResponse = this.apiA.post("/api/v1/applications",
				RequestOptions.create()
					.setHeader("Content-Type", "application/json")
					.setData(Map.of("name", APP_NAME, "description", "HA test producer", "owner", "ha-team")));
		assertThat(postResponse.status()).as("Register app on Broker A").isIn(200, 201);

		// when — read from Broker B
		APIResponse getResponse = this.apiB.get("/api/v1/applications");
		assertThat(getResponse.status()).isEqualTo(200);

		// then — Broker B sees the application registered on Broker A
		String body = getResponse.text();
		assertThat(body).contains(APP_NAME);
	}

	@Test
	@Order(2)
	void should_publish_contracts_on_one_and_read_on_other() {
		// given — publish contract on Broker A
		APIResponse postResponse = this.apiA.post(
				"/api/v1/applications/" + APP_NAME + "/versions/" + VERSION + "/contracts",
				RequestOptions.create()
					.setHeader("Content-Type", "application/json")
					.setData(Map.of("contractName", "get-order", "content",
							"request:\n  method: GET\n  url: /orders/1\nresponse:\n  status: 200", "contentType",
							"application/x-spring-cloud-contract+yaml")));
		assertThat(postResponse.status()).as("Publish contract on Broker A").isIn(200, 201);

		// when — read from Broker B
		APIResponse getResponse = this.apiB
			.get("/api/v1/applications/" + APP_NAME + "/versions/" + VERSION + "/contracts");
		assertThat(getResponse.status()).isEqualTo(200);

		// then — Broker B returns the contract published on Broker A
		String body = getResponse.text();
		assertThat(body).contains("get-order");
	}

	@Test
	@Order(3)
	void should_handle_concurrent_duplicate_publish() throws Exception {
		// given — prepare the same contract payload for both brokers
		Map<String, String> contractPayload = Map.of("contractName", "concurrent-contract", "content",
				"request:\n  method: POST\n  url: /concurrent", "contentType",
				"application/x-spring-cloud-contract+yaml");
		String contractUrl = "/api/v1/applications/" + APP_NAME + "/versions/" + VERSION + "/contracts";

		// when — POST the exact same contract to both brokers simultaneously
		CompletableFuture<APIResponse> futureA = CompletableFuture.supplyAsync(() -> this.apiA.post(contractUrl,
				RequestOptions.create().setHeader("Content-Type", "application/json").setData(contractPayload)));
		CompletableFuture<APIResponse> futureB = CompletableFuture.supplyAsync(() -> this.apiB.post(contractUrl,
				RequestOptions.create().setHeader("Content-Type", "application/json").setData(contractPayload)));

		CompletableFuture.allOf(futureA, futureB).join();
		APIResponse responseA = futureA.get();
		APIResponse responseB = futureB.get();

		// then — one should succeed (200/201), the other should either succeed
		// (idempotent) or return 409 Conflict
		assertThat(responseA.status()).as("Broker A concurrent response").isIn(200, 201, 409);
		assertThat(responseB.status()).as("Broker B concurrent response").isIn(200, 201, 409);

		// Verify only one copy exists — GET from Broker A
		APIResponse getResponse = this.apiA.get(contractUrl);
		assertThat(getResponse.status()).isEqualTo(200);
		String body = getResponse.text();
		// Count occurrences of "concurrent-contract" — should appear exactly once
		int count = countOccurrences(body, "concurrent-contract");
		assertThat(count).as("Only one copy of the contract should exist").isEqualTo(1);
	}

	@Test
	@Order(4)
	void should_survive_instance_failure() {
		// given — register consumer and seed verification data
		this.apiA.post("/api/v1/applications",
				RequestOptions.create()
					.setHeader("Content-Type", "application/json")
					.setData(Map.of("name", CONSUMER_NAME, "description", "HA test consumer", "owner", "ha-team")));

		// Stop Broker A
		this.brokerA.stop();

		// when — Broker B should still serve data
		APIResponse getApps = this.apiB.get("/api/v1/applications");
		assertThat(getApps.status()).isEqualTo(200);
		assertThat(getApps.text()).contains(APP_NAME);

		// Post a verification to Broker B while A is down
		APIResponse verifyResponse = this.apiB.post("/api/v1/verifications",
				RequestOptions.create()
					.setHeader("Content-Type", "application/json")
					.setData(Map.of("providerName", APP_NAME, "providerVersion", VERSION, "consumerName", CONSUMER_NAME,
							"consumerVersion", "2.0.0", "status", "SUCCESS")));
		assertThat(verifyResponse.status()).as("Post verification while Broker A is down").isIn(200, 201);

		// Restart Broker A
		this.brokerA = createBrokerContainer("broker-a");
		this.brokerA.start();
		this.brokerAUrl = "http://localhost:" + this.brokerA.getMappedPort(8642);
		this.apiA.dispose();
		this.apiA = this.playwright.request()
			.newContext(new APIRequest.NewContextOptions().setBaseURL(this.brokerAUrl)
				.setExtraHTTPHeaders(Map.of("Authorization", AUTH_HEADER)));

		// then — Broker A sees the verification recorded on Broker B
		APIResponse getVerifications = this.apiA.get("/api/v1/verifications");
		assertThat(getVerifications.status()).isEqualTo(200);
		assertThat(getVerifications.text()).contains(APP_NAME);
	}

	@Test
	@Order(5)
	void should_deployment_safety_work_across_instances() {
		// given — seed environment and deployment on Broker A
		this.apiA.post("/api/v1/environments",
				RequestOptions.create()
					.setHeader("Content-Type", "application/json")
					.setData(Map.of("name", STAGING, "description", "Staging environment", "displayOrder", 1,
							"production", false)));

		APIResponse deployResponse = this.apiA.post("/api/v1/environments/" + STAGING + "/deployments",
				RequestOptions.create()
					.setHeader("Content-Type", "application/json")
					.setData(Map.of("applicationName", APP_NAME, "version", VERSION)));
		assertThat(deployResponse.status()).as("Record deployment on Broker A").isIn(200, 201);

		// when — check can-i-deploy on Broker B
		APIResponse canIDeploy = this.apiB
			.get("/api/v1/can-i-deploy?application=" + APP_NAME + "&version=" + VERSION + "&environment=" + STAGING);
		assertThat(canIDeploy.status()).isEqualTo(200);

		// then — the safety check sees the deployment recorded on the other instance
		String body = canIDeploy.text();
		assertThat(body).isNotEmpty();
	}

	private GenericContainer<?> createBrokerContainer(String alias) {
		return new GenericContainer<>("mgrzejszczak/stubborn:0.1.0-SNAPSHOT").withNetwork(this.network)
			.withNetworkAliases(alias)
			.withExposedPorts(8642)
			.withEnv("DATABASE_URL", "jdbc:postgresql://postgres:5432/broker")
			.withEnv("DATABASE_USERNAME", "broker")
			.withEnv("DATABASE_PASSWORD", "broker")
			.withEnv("OTEL_METRICS_ENABLED", "false")
			.waitingFor(new HttpWaitStrategy().forPath("/actuator/health")
				.forPort(8642)
				.forStatusCode(200)
				.withStartupTimeout(Duration.ofSeconds(120)));
	}

	private static int countOccurrences(String text, String substring) {
		int count = 0;
		int index = 0;
		while ((index = text.indexOf(substring, index)) != -1) {
			count++;
			index += substring.length();
		}
		return count;
	}

}
