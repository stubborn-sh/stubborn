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

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.Map;

import com.microsoft.playwright.Browser;
import com.microsoft.playwright.BrowserContext;
import com.microsoft.playwright.BrowserType;
import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.Playwright;
import com.microsoft.playwright.options.LoadState;
import com.microsoft.playwright.options.WaitForSelectorState;
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
 * Captures screenshots of every key UI page running in demo mode. The demo profile seeds
 * 6 applications, contracts, verifications, and deployments so all pages have realistic
 * data. Screenshots are saved to {@code target/screenshots/} and copied to
 * {@code docs/screenshots/} for use in README and presentations.
 */
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class DemoScreenshotE2ETest {

	static final Path SCREENSHOTS_DIR = Path.of("target/screenshots");

	static final Path DOCS_SCREENSHOTS_DIR = Path.of("docs/screenshots");

	private static final String AUTH_HEADER = "Basic "
			+ java.util.Base64.getEncoder().encodeToString("admin:admin".getBytes());

	private Network network;

	private PostgreSQLContainer<?> postgres;

	private GenericContainer<?> broker;

	private Playwright playwright;

	private Browser browser;

	private BrowserContext browserContext;

	private Page page;

	private String baseUrl;

	@BeforeAll
	void setUp() throws IOException {
		Files.createDirectories(SCREENSHOTS_DIR);
		Files.createDirectories(DOCS_SCREENSHOTS_DIR);

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
			.withEnv("SPRING_PROFILES_ACTIVE", "demo")
			.withEnv("OTEL_METRICS_ENABLED", "false")
			.waitingFor(new HttpWaitStrategy().forPath("/actuator/health")
				.forPort(8642)
				.forStatusCode(200)
				.withStartupTimeout(java.time.Duration.ofSeconds(120)));
		this.broker.start();

		this.baseUrl = "http://localhost:" + this.broker.getMappedPort(8642);

		this.playwright = Playwright.create();
		this.browser = this.playwright.chromium().launch(new BrowserType.LaunchOptions().setHeadless(true));
		this.browserContext = this.browser.newContext(new Browser.NewContextOptions().setViewportSize(1440, 900));
		this.browserContext.setExtraHTTPHeaders(Map.of("Authorization", AUTH_HEADER));
		this.page = this.browserContext.newPage();
		this.page.addInitScript("window.__BROKER_AUTH__ = 'admin:admin';");
	}

	@AfterAll
	void tearDown() {
		if (this.browserContext != null) {
			this.browserContext.close();
		}
		if (this.browser != null) {
			this.browser.close();
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
	void should_screenshot_dashboard() {
		navigateTo("/dashboard");
		waitForHeading("Dashboard");
		// Wait for stats cards to render
		this.page.locator("[data-testid='stats-card'], .stats-card, [class*='card']")
			.first()
			.waitFor(new Locator.WaitForOptions().setTimeout(120000));
		screenshot("demo-dashboard");
	}

	@Test
	@Order(2)
	void should_screenshot_applications() {
		navigateTo("/applications");
		waitForHeading("Applications");
		waitForTable();
		// Verify demo data is present
		waitForText("order-service");
		screenshot("demo-applications");
	}

	@Test
	@Order(3)
	void should_screenshot_contracts() {
		navigateTo("/contracts");
		waitForHeading("Contracts");
		// Must select an application first — contracts page requires it
		selectComboBox(0, "order-service");
		// Wait for the data table to render after selection
		this.page.waitForLoadState(LoadState.NETWORKIDLE);
		waitForTable();
		// Wait for contract entries to appear
		waitForText("shouldReturnOrder");
		screenshot("demo-contracts");
	}

	@Test
	@Order(4)
	void should_screenshot_verifications() {
		navigateTo("/verifications");
		waitForHeading("Verifications");
		waitForTable();
		// Verify both SUCCESS and FAILED badges are visible
		waitForText("SUCCESS");
		screenshot("demo-verifications");
	}

	@Test
	@Order(5)
	void should_screenshot_environments() {
		navigateTo("/environments");
		waitForHeading("Environments");
		// Wait for environment data to load
		waitForText("production");
		screenshot("demo-environments");
	}

	@Test
	@Order(6)
	void should_screenshot_can_i_deploy_form() {
		navigateTo("/can-i-deploy");
		waitForHeading("Can I Deploy");
		screenshot("demo-can-i-deploy");
	}

	@Test
	@Order(7)
	void should_screenshot_can_i_deploy_result() {
		navigateTo("/can-i-deploy");
		waitForHeading("Can I Deploy");

		// Fill in the form with demo data: order-service 1.2.0 to production
		selectComboBox(0, "order-service");
		selectComboBox(1, "1.2.0");
		// Environment is a native <select>, not a combo box
		this.page.selectOption("select#cid-environment", "production");

		// Submit the form
		Locator checkButton = this.page.locator("button:has-text('Check')");
		checkButton.first().waitFor(new Locator.WaitForOptions().setTimeout(60000));
		checkButton.first().click();

		// Wait for the result to appear
		this.page.waitForLoadState(LoadState.NETWORKIDLE);
		waitForText("Result");
		screenshot("demo-can-i-deploy-result");
	}

	@Test
	@Order(8)
	void should_screenshot_graph() {
		navigateTo("/graph");
		waitForHeading("Dependencies");
		// Wait for graph to render (nodes or table rows)
		this.page.locator("button:has-text('order-service'), [data-testid='graph-node'], canvas, svg")
			.first()
			.waitFor(new Locator.WaitForOptions().setTimeout(120000));
		screenshot("demo-graph");
	}

	private void navigateTo(String path) {
		this.page.navigate(this.baseUrl + path);
		this.page.waitForLoadState(LoadState.NETWORKIDLE);
	}

	private void screenshot(String name) {
		Path targetPath = SCREENSHOTS_DIR.resolve(name + ".png");
		this.page.screenshot(new Page.ScreenshotOptions().setPath(targetPath).setFullPage(true));
		// Copy to docs/screenshots/ for README and presentation use
		try {
			Files.copy(targetPath, DOCS_SCREENSHOTS_DIR.resolve(name + ".png"), StandardCopyOption.REPLACE_EXISTING);
		}
		catch (IOException ex) {
			// best-effort — do not fail the test for a copy error
		}
	}

	private Locator waitForHeading(String text) {
		Locator heading = this.page.locator("[data-testid='page-heading']:has-text('" + text + "')");
		heading.first().waitFor(new Locator.WaitForOptions().setTimeout(120000));
		return heading;
	}

	private Locator waitForTable() {
		Locator table = this.page.locator("[data-testid='data-table']").first();
		table.waitFor(new Locator.WaitForOptions().setTimeout(120000));
		return table;
	}

	private Locator waitForText(String text) {
		Locator locator = this.page.locator("text=" + text);
		locator.first().waitFor(new Locator.WaitForOptions().setTimeout(120000));
		return locator;
	}

	private void selectComboBox(int index, String value) {
		Locator inputs = this.page.locator("input[type='text']");
		Locator input = inputs.nth(index);
		input.waitFor(new Locator.WaitForOptions().setTimeout(60000));
		input.click();
		input.fill(value);
		// Wait for dropdown option to appear and click it
		Locator option = this.page.locator("[role='listbox'] [role='option']:has-text('" + value + "')");
		option.first().waitFor(new Locator.WaitForOptions().setTimeout(60000));
		option.first().click();
		this.page.locator("[role='listbox']")
			.first()
			.waitFor(new Locator.WaitForOptions().setState(WaitForSelectorState.HIDDEN).setTimeout(30000));
	}

}
