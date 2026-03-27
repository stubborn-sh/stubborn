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
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.Network;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.containers.wait.strategy.HttpWaitStrategy;
import org.testcontainers.containers.wait.strategy.Wait;

import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;

/**
 * Chaos E2E test proving the broker's webhook dispatch circuit breaker works under
 * failure conditions. Registers a webhook pointing to a WireMock stub that introduces a
 * 30-second delay (exceeding the 15-second read timeout). After enough timeouts, the
 * circuit breaker opens and records "circuit breaker open" fallback entries.
 *
 * <p>
 * Uses its own containers (not SharedContainers) for isolation.
 *
 * @see <a href="../../../docs/specs/033-chaos-testing.md">Spec 033 — Chaos Testing</a>
 */
@Tag("chaos")
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class ChaosWebhookE2ETest {

	private static final String AUTH_HEADER = "Basic "
			+ java.util.Base64.getEncoder().encodeToString("admin:admin".getBytes());

	private static final String APP_NAME = "chaos-whk-producer";

	private static final String WEBHOOK_PATH = "/slow-webhook";

	private Network network;

	private PostgreSQLContainer<?> postgres;

	private GenericContainer<?> wiremock;

	private GenericContainer<?> broker;

	private Playwright playwright;

	private APIRequestContext api;

	private APIRequestContext wiremockApi;

	private String brokerUrl;

	private String wiremockInternalUrl;

	private String webhookId;

	@BeforeAll
	void setUp() {
		this.network = Network.newNetwork();

		this.postgres = new PostgreSQLContainer<>("postgres:16-alpine").withNetwork(this.network)
			.withNetworkAliases("postgres")
			.withDatabaseName("broker")
			.withUsername("broker")
			.withPassword("broker");
		this.postgres.start();

		this.wiremock = new GenericContainer<>("wiremock/wiremock:3.13.0").withNetwork(this.network)
			.withNetworkAliases("wiremock")
			.withExposedPorts(8080)
			.withCommand("--verbose")
			.waitingFor(Wait.forHttp("/__admin/mappings").forPort(8080).forStatusCode(200));
		this.wiremock.start();

		this.wiremockInternalUrl = "http://wiremock:8080";

		this.broker = new GenericContainer<>("mgrzejszczak/stubborn:0.1.0-SNAPSHOT").withNetwork(this.network)
			.withExposedPorts(8642)
			.withEnv("DATABASE_URL", "jdbc:postgresql://postgres:5432/broker")
			.withEnv("DATABASE_USERNAME", "broker")
			.withEnv("DATABASE_PASSWORD", "broker")
			.withEnv("OTEL_METRICS_ENABLED", "false")
			// Tighten webhook circuit breaker for faster test execution
			.withEnv("RESILIENCE4J_CIRCUITBREAKER_INSTANCES_WEBHOOKDISPATCH_SLIDINGWINDOWSIZE", "5")
			.withEnv("RESILIENCE4J_CIRCUITBREAKER_INSTANCES_WEBHOOKDISPATCH_MINIMUMNUMBEROFCALLS", "3")
			.withEnv("RESILIENCE4J_CIRCUITBREAKER_INSTANCES_WEBHOOKDISPATCH_FAILURERATETHRESHOLD", "50")
			.withEnv("RESILIENCE4J_CIRCUITBREAKER_INSTANCES_WEBHOOKDISPATCH_WAITDURATIONINOPENSTATE", "30s")
			.waitingFor(new HttpWaitStrategy().forPath("/actuator/health")
				.forPort(8642)
				.forStatusCode(200)
				.withStartupTimeout(Duration.ofSeconds(120)));
		this.broker.start();

		this.brokerUrl = "http://localhost:" + this.broker.getMappedPort(8642);
		String wiremockUrl = "http://localhost:" + this.wiremock.getMappedPort(8080);

		this.playwright = Playwright.create();
		this.api = this.playwright.request()
			.newContext(new APIRequest.NewContextOptions().setBaseURL(this.brokerUrl)
				.setExtraHTTPHeaders(Map.of("Authorization", AUTH_HEADER)));
		this.wiremockApi = this.playwright.request()
			.newContext(new APIRequest.NewContextOptions().setBaseURL(wiremockUrl));
	}

	@AfterAll
	void tearDown() {
		if (this.wiremockApi != null) {
			this.wiremockApi.dispose();
		}
		if (this.api != null) {
			this.api.dispose();
		}
		if (this.playwright != null) {
			this.playwright.close();
		}
		if (this.broker != null) {
			this.broker.stop();
		}
		if (this.wiremock != null) {
			this.wiremock.stop();
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
	void should_set_up_slow_webhook() {
		// given — register a WireMock stub with a 30-second delay (broker timeout is 15s)
		String stubMapping = """
				{
				  "request": {
				    "method": "POST",
				    "urlPath": "%s"
				  },
				  "response": {
				    "status": 200,
				    "body": "OK",
				    "fixedDelayMilliseconds": 30000
				  }
				}
				""".formatted(WEBHOOK_PATH);
		APIResponse stubResponse = this.wiremockApi.post("/__admin/mappings",
				RequestOptions.create().setHeader("Content-Type", "application/json").setData(stubMapping));
		assertThat(stubResponse.status()).as("Register WireMock slow stub").isIn(200, 201);

		// Seed the application
		APIResponse appResponse = this.api.post("/api/v1/applications",
				RequestOptions.create()
					.setHeader("Content-Type", "application/json")
					.setData(Map.of("name", APP_NAME, "description", "Chaos webhook test", "owner", "chaos-team")));
		assertThat(appResponse.status()).as("Seed app").isIn(200, 201);

		// Register a webhook pointing to the slow WireMock endpoint
		APIResponse whkResponse = this.api.post("/api/v1/webhooks", RequestOptions.create()
			.setHeader("Content-Type", "application/json")
			.setData(Map.of("eventType", "CONTRACT_PUBLISHED", "url", this.wiremockInternalUrl + WEBHOOK_PATH)));
		assertThat(whkResponse.status()).as("Create webhook").isIn(200, 201);

		// Extract webhook ID for later execution queries
		String body = whkResponse.text();
		this.webhookId = extractId(body);
		assertThat(this.webhookId).as("Webhook ID extracted").isNotNull();
	}

	@Test
	@Order(2)
	void should_trip_circuit_breaker_after_repeated_timeouts() {
		// given — publish multiple contracts to trigger multiple webhook dispatches
		// Each dispatch will timeout after 15s (broker read timeout) against the 30s
		// delay
		// The webhook dispatcher has retries (3), so each publish generates multiple
		// calls
		// We need at least 3 calls to meet minimum-number-of-calls
		for (int i = 0; i < 4; i++) {
			this.api.post("/api/v1/applications/" + APP_NAME + "/versions/1.0." + i + "/contracts",
					RequestOptions.create()
						.setHeader("Content-Type", "application/json")
						.setData(Map.of("contractName", "chaos-contract-" + i, "content",
								"request:\n  method: GET\n  url: /chaos/" + i, "contentType",
								"application/x-spring-cloud-contract+yaml")));
		}

		// when — wait for webhook dispatches to fail (each takes ~15s to timeout,
		// plus retries). The circuit breaker should eventually open.
		// We poll the executions endpoint waiting for a "circuit breaker open" entry.
		await().atMost(Duration.ofMinutes(5)).pollInterval(Duration.ofSeconds(5)).untilAsserted(() -> {
			APIResponse execResponse = this.api
				.get("/api/v1/webhooks/" + this.webhookId + "/executions?size=50&sort=createdAt,desc");
			assertThat(execResponse.status()).isEqualTo(200);
			String body = execResponse.text();
			// then — at least one execution should have the circuit breaker open fallback
			assertThat(body).as("Should contain circuit breaker open fallback entry")
				.containsIgnoringCase("circuit breaker open");
		});
	}

	@Test
	@Order(3)
	void should_have_recorded_both_failure_and_circuit_open_executions() {
		// Verify the executions contain both regular failures and circuit breaker entries
		APIResponse execResponse = this.api
			.get("/api/v1/webhooks/" + this.webhookId + "/executions?size=50&sort=createdAt,desc");
		assertThat(execResponse.status()).isEqualTo(200);
		String body = execResponse.text();

		// Should have timeout failures (from actual dispatch attempts)
		assertThat(body).as("Should contain failed executions").containsIgnoringCase("FAILURE");

		// Should have circuit breaker open entries (from fallback)
		assertThat(body).as("Should contain circuit breaker open entries").containsIgnoringCase("circuit breaker open");
	}

	/**
	 * Extracts the "id" field value from a JSON response string. Simple extraction
	 * without pulling in a JSON parser dependency.
	 */
	private static String extractId(String json) {
		// Look for "id":"<uuid>" or "id" : "<uuid>"
		int idIndex = json.indexOf("\"id\"");
		if (idIndex < 0) {
			return null;
		}
		int colonIndex = json.indexOf(':', idIndex);
		int quoteStart = json.indexOf('"', colonIndex + 1);
		int quoteEnd = json.indexOf('"', quoteStart + 1);
		if (quoteStart < 0 || quoteEnd < 0) {
			return null;
		}
		return json.substring(quoteStart + 1, quoteEnd);
	}

}
