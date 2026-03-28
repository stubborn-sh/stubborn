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
import java.time.Duration;
import java.util.Map;
import java.util.concurrent.TimeUnit;

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
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.junit.jupiter.api.TestMethodOrder;
import org.junit.jupiter.api.Timeout;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.Network;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.containers.wait.strategy.HttpWaitStrategy;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * E2E tests for the Maven Import and Git Import UI pages. Verifies that pages render
 * correctly, forms submit successfully, and table data updates accordingly.
 */
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
@Timeout(value = 10, unit = TimeUnit.MINUTES)
class ImportUiE2ETest {

	private static final Path SCREENSHOTS_DIR = Path.of("target/screenshots");

	private static final int TIMEOUT_MS = 120_000;

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
				.withStartupTimeout(Duration.ofSeconds(300)));
		this.broker.start();

		this.baseUrl = "http://localhost:" + this.broker.getMappedPort(8642);

		this.playwright = Playwright.create();
		this.browser = this.playwright.chromium().launch(new BrowserType.LaunchOptions().setHeadless(true));
		this.browserContext = this.browser.newContext(new Browser.NewContextOptions().setViewportSize(1440, 900));
		this.page = this.browserContext.newPage();
		this.page.onConsoleMessage(msg -> System.out.println("[BROWSER " + msg.type() + "] " + msg.text()));
		this.page.onPageError(error -> System.out.println("[BROWSER ERROR] " + error));
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
	void should_render_maven_import_page() {
		navigateTo("/maven-import");
		Locator heading = waitForHeading("Maven Import");
		assertThat(heading.isVisible()).isTrue();

		// Verify the data table is rendered
		Locator table = waitForTable();
		assertThat(table.isVisible()).isTrue();

		// Verify the Register Source and Import JAR buttons exist
		Locator registerButton = this.page.locator("button:has-text('Register Source')");
		registerButton.first().waitFor(new Locator.WaitForOptions().setTimeout(TIMEOUT_MS));
		assertThat(registerButton.first().isVisible()).isTrue();

		Locator importButton = this.page.locator("button:has-text('Import JAR')");
		assertThat(importButton.first().isVisible()).isTrue();
	}

	@Test
	@Order(2)
	void should_render_git_import_page() {
		navigateTo("/git-import");
		Locator heading = waitForHeading("Git Import");
		assertThat(heading.isVisible()).isTrue();

		// Verify the data table is rendered
		Locator table = waitForTable();
		assertThat(table.isVisible()).isTrue();

		// Verify the Register Source and Import from Git buttons exist
		Locator registerButton = this.page.locator("button:has-text('Register Source')");
		registerButton.first().waitFor(new Locator.WaitForOptions().setTimeout(TIMEOUT_MS));
		assertThat(registerButton.first().isVisible()).isTrue();

		Locator importButton = this.page.locator("button:has-text('Import from Git')");
		assertThat(importButton.first().isVisible()).isTrue();
	}

	@Test
	@Order(3)
	void should_register_and_list_maven_source() {
		navigateTo("/maven-import");
		waitForHeading("Maven Import");
		waitForTable();

		// Click "Register Source" to open the form
		this.page.locator("button:has-text('Register Source')").first().click();

		// Wait for the form card to appear
		Locator formTitle = this.page.locator("text=Register Maven Source");
		formTitle.first().waitFor(new Locator.WaitForOptions().setTimeout(TIMEOUT_MS));

		// Fill in the form fields by label
		fillInputByLabel("Repository URL", "https://repo.example.com");
		fillInputByLabel("Group ID", "com.example");
		fillInputByLabel("Artifact ID", "test-service");

		// Submit the form
		Locator submitButton = this.page.locator("button:has-text('Register')").last();
		submitButton.click();

		// Wait for the form to close (Register Source button text returns)
		this.page.locator("button:has-text('Register Source')")
			.first()
			.waitFor(new Locator.WaitForOptions().setTimeout(TIMEOUT_MS));

		// Verify the source appears in the table
		this.page.waitForLoadState(LoadState.NETWORKIDLE);
		waitForText("repo.example.com");
		waitForText("com.example");
		waitForText("test-service");
	}

	@Test
	@Order(4)
	@Tag("online")
	void should_import_from_git_repository() {
		navigateTo("/git-import");
		waitForHeading("Git Import");
		waitForTable();

		// Click "Import from Git" to open the on-demand import form
		this.page.locator("button:has-text('Import from Git')").first().click();

		// Wait for the form card to appear
		Locator formTitle = this.page.locator("text=Import from Git");
		formTitle.first().waitFor(new Locator.WaitForOptions().setTimeout(TIMEOUT_MS));

		// Fill in the form
		fillInputByLabel("Application Name", "beer-api-producer-external");
		fillInputByLabel("Repository URL", "https://github.com/spring-cloud-samples/spring-cloud-contract-samples.git");
		fillInputByLabel("Branch", "main");
		fillInputByLabel("Contracts Directory", "beer_contracts/src/main/resources/contracts/");

		// Submit the form
		Locator submitButton = this.page.locator("button:has-text('Import')").last();
		submitButton.click();

		// Wait for import result — this clones from GitHub so may take a while
		Locator resultBox = this.page.locator("text=Import complete");
		resultBox.first().waitFor(new Locator.WaitForOptions().setTimeout(TIMEOUT_MS));

		// Verify published > 0
		String resultText = resultBox.first().textContent();
		assertThat(resultText).contains("published");
		// Extract published count and verify it's > 0
		// Format: "Import complete: N published, M skipped, T total (version: ...)"
		assertThat(resultText).doesNotContain("0 published");
	}

	@Test
	@Order(5)
	void should_delete_maven_source() {
		navigateTo("/maven-import");
		waitForHeading("Maven Import");
		waitForTable();

		// Ensure the previously registered source is visible
		waitForText("repo.example.com");

		// Click the Delete button on the first source row
		Locator deleteButton = this.page.locator("button:has-text('Delete')");
		deleteButton.first().waitFor(new Locator.WaitForOptions().setTimeout(TIMEOUT_MS));
		deleteButton.first().click();

		// Click the Confirm button in the confirmation dialog
		Locator confirmButton = this.page.locator("button:has-text('Confirm')");
		confirmButton.first().waitFor(new Locator.WaitForOptions().setTimeout(TIMEOUT_MS));
		confirmButton.first().click();

		// Wait for network to settle after deletion
		this.page.waitForLoadState(LoadState.NETWORKIDLE);

		// Verify the source is removed — "repo.example.com" should no longer be in the
		// table
		this.page.locator("text=repo.example.com")
			.first()
			.waitFor(new Locator.WaitForOptions().setState(WaitForSelectorState.HIDDEN).setTimeout(TIMEOUT_MS));
	}

	private boolean loggedIn = false;

	private void ensureLoggedIn() {
		if (this.loggedIn) {
			return;
		}
		// Navigate to root to trigger the login page
		this.page.navigate(this.baseUrl + "/");
		this.page.waitForLoadState(LoadState.DOMCONTENTLOADED);
		// Wait for React to mount anything inside #root
		this.page.waitForFunction("document.getElementById('root')?.children.length > 0", null,
				new Page.WaitForFunctionOptions().setTimeout(TIMEOUT_MS));
		screenshot("debug-after-react-mount");
		// Wait for the Sign in button to appear (React must mount and render LoginPage)
		Locator signInButton = this.page.locator("button:has-text('Sign in')");
		signInButton.first().waitFor(new Locator.WaitForOptions().setTimeout(TIMEOUT_MS));
		// Fill in credentials and submit
		this.page.fill("#username", "admin");
		this.page.fill("#password", "admin");
		signInButton.first().click();
		// Wait for the dashboard page heading to confirm successful login
		this.page.locator("[data-testid='page-heading']:has-text('Dashboard')")
			.first()
			.waitFor(new Locator.WaitForOptions().setTimeout(TIMEOUT_MS));
		this.loggedIn = true;
	}

	private void navigateTo(String path) {
		ensureLoggedIn();
		this.page.navigate(this.baseUrl + path);
		this.page.waitForLoadState(LoadState.NETWORKIDLE);
	}

	private Locator waitForHeading(String text) {
		Locator heading = this.page.locator("[data-testid='page-heading']:has-text('" + text + "')");
		heading.first().waitFor(new Locator.WaitForOptions().setTimeout(TIMEOUT_MS));
		return heading;
	}

	private Locator waitForTable() {
		Locator table = this.page.locator("[data-testid='data-table']").first();
		table.waitFor(new Locator.WaitForOptions().setTimeout(TIMEOUT_MS));
		return table;
	}

	private Locator waitForText(String text) {
		Locator locator = this.page.locator("text=" + text);
		locator.first().waitFor(new Locator.WaitForOptions().setTimeout(TIMEOUT_MS));
		return locator;
	}

	private void screenshot(String name) {
		this.page
			.screenshot(new Page.ScreenshotOptions().setPath(SCREENSHOTS_DIR.resolve(name + ".png")).setFullPage(true));
	}

	private void fillInputByLabel(String labelText, String value) {
		// Find the label, then fill the sibling input within the same container
		Locator container = this.page.locator("div.space-y-2:has(label:has-text('" + labelText + "'))");
		Locator input = container.locator("input").first();
		input.waitFor(new Locator.WaitForOptions().setTimeout(TIMEOUT_MS));
		input.fill(value);
	}

}
