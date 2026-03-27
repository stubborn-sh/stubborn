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

import java.sql.Connection;
import java.sql.DatabaseMetaData;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
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
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.junit.jupiter.api.TestMethodOrder;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.Network;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.containers.wait.strategy.HttpWaitStrategy;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Flyway Migration E2E test that proves all migrations V1-V12 apply cleanly to a bare
 * PostgreSQL database and that basic CRUD operations work on the resulting schema.
 * <p>
 * Spins up its own PostgreSQL + broker containers (not sharing {@link SharedContainers})
 * so that the database starts completely empty and Flyway runs all migrations from
 * scratch.
 *
 * @see <a href="../../../docs/specs/031-migration-integrity.md">Spec 031 — Migration
 * Integrity</a>
 */
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class FlywayMigrationE2ETest {

	private static final String AUTH_HEADER = "Basic "
			+ java.util.Base64.getEncoder().encodeToString("admin:admin".getBytes());

	private static final String APP_NAME = "mig-producer";

	private static final String CONSUMER_NAME = "mig-consumer";

	private static final String VERSION = "1.0.0";

	private static final String ENV_NAME = "mig-staging";

	/** All tables that should exist after migrations V1-V12 complete. */
	private static final List<String> EXPECTED_TABLES = List.of("applications", "contracts", "verifications",
			"deployments", "audit_log", "webhooks", "webhook_executions", "version_tags", "environments",
			"maven_import_sources", "flyway_schema_history");

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
	void should_have_all_expected_tables_after_migration() throws Exception {
		// given — broker has started, meaning Flyway migrations ran successfully
		// when — query the database directly for table names
		List<String> tables = new ArrayList<>();
		try (Connection conn = DriverManager.getConnection(this.postgres.getJdbcUrl(), this.postgres.getUsername(),
				this.postgres.getPassword())) {
			DatabaseMetaData meta = conn.getMetaData();
			try (ResultSet rs = meta.getTables(null, "public", null, new String[] { "TABLE" })) {
				while (rs.next()) {
					tables.add(rs.getString("TABLE_NAME"));
				}
			}
		}

		// then — every expected table exists
		assertThat(tables).as("Tables present after Flyway migration").containsAll(EXPECTED_TABLES);
	}

	@Test
	@Order(2)
	void should_have_columns_from_alter_migrations() throws Exception {
		// V6 adds main_branch to applications, branch to contracts/verifications
		// V7 adds content_hash to contracts
		// V12 adds repository_url to applications
		try (Connection conn = DriverManager.getConnection(this.postgres.getJdbcUrl(), this.postgres.getUsername(),
				this.postgres.getPassword())) {
			assertColumnExists(conn, "applications", "main_branch");
			assertColumnExists(conn, "applications", "repository_url");
			assertColumnExists(conn, "contracts", "branch");
			assertColumnExists(conn, "contracts", "content_hash");
			assertColumnExists(conn, "verifications", "branch");
		}
	}

	@Test
	@Order(3)
	void should_report_healthy() {
		// when
		APIResponse response = this.api.get("/actuator/health");

		// then
		assertThat(response.status()).isEqualTo(200);
		assertThat(response.text()).contains("UP");
	}

	@Test
	@Order(4)
	void should_register_application() {
		// when
		APIResponse response = this.api.post("/api/v1/applications",
				RequestOptions.create()
					.setHeader("Content-Type", "application/json")
					.setData(Map.of("name", APP_NAME, "description", "Migration test producer", "owner", "mig-team")));

		// then
		assertThat(response.status()).as("Register application").isIn(200, 201);
	}

	@Test
	@Order(5)
	void should_register_consumer_application() {
		// when
		APIResponse response = this.api.post("/api/v1/applications", RequestOptions.create()
			.setHeader("Content-Type", "application/json")
			.setData(Map.of("name", CONSUMER_NAME, "description", "Migration test consumer", "owner", "mig-team")));

		// then
		assertThat(response.status()).as("Register consumer application").isIn(200, 201);
	}

	@Test
	@Order(6)
	void should_publish_contract() {
		// when
		APIResponse response = this.api.post("/api/v1/applications/" + APP_NAME + "/versions/" + VERSION + "/contracts",
				RequestOptions.create()
					.setHeader("Content-Type", "application/json")
					.setData(Map.of("contractName", "get-order", "content",
							"request:\n  method: GET\n  url: /orders/1\nresponse:\n  status: 200", "contentType",
							"application/x-spring-cloud-contract+yaml")));

		// then
		assertThat(response.status()).as("Publish contract").isIn(200, 201);
	}

	@Test
	@Order(7)
	void should_record_verification() {
		// when
		APIResponse response = this.api.post("/api/v1/verifications",
				RequestOptions.create()
					.setHeader("Content-Type", "application/json")
					.setData(Map.of("providerName", APP_NAME, "providerVersion", VERSION, "consumerName", CONSUMER_NAME,
							"consumerVersion", "2.0.0", "status", "SUCCESS")));

		// then
		assertThat(response.status()).as("Record verification").isIn(200, 201);
	}

	@Test
	@Order(8)
	void should_create_environment() {
		// when
		APIResponse response = this.api.post("/api/v1/environments",
				RequestOptions.create()
					.setHeader("Content-Type", "application/json")
					.setData(Map.of("name", ENV_NAME, "description", "Migration test staging", "displayOrder", 1,
							"production", false)));

		// then
		assertThat(response.status()).as("Create environment").isIn(200, 201);
	}

	@Test
	@Order(9)
	void should_record_deployment() {
		// when
		APIResponse response = this.api.post("/api/v1/environments/" + ENV_NAME + "/deployments",
				RequestOptions.create()
					.setHeader("Content-Type", "application/json")
					.setData(Map.of("applicationName", APP_NAME, "version", VERSION)));

		// then
		assertThat(response.status()).as("Record deployment").isIn(200, 201);
	}

	private static void assertColumnExists(Connection conn, String table, String column) throws Exception {
		DatabaseMetaData meta = conn.getMetaData();
		try (ResultSet rs = meta.getColumns(null, "public", table, column)) {
			assertThat(rs.next()).as("Column %s.%s should exist", table, column).isTrue();
		}
	}

}
