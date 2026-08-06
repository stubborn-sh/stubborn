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
import java.util.Map;
import java.util.function.Supplier;

import com.microsoft.playwright.APIRequest;
import com.microsoft.playwright.APIRequestContext;
import com.microsoft.playwright.APIResponse;
import com.microsoft.playwright.Browser;
import com.microsoft.playwright.BrowserContext;
import com.microsoft.playwright.BrowserType;
import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.Playwright;
import com.microsoft.playwright.PlaywrightException;
import com.microsoft.playwright.options.LoadState;
import com.microsoft.playwright.options.RequestOptions;
import com.microsoft.playwright.options.WaitForSelectorState;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.TestInstance;
import org.junit.jupiter.api.TestMethodOrder;
import org.junit.jupiter.api.extension.ExtensionContext;
import org.junit.jupiter.api.extension.RegisterExtension;
import org.junit.jupiter.api.extension.TestWatcher;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Abstract base class for parallel E2E test classes. Each subclass gets its own
 * Playwright browser instance and page, sharing the containers from
 * {@link SharedContainers}.
 */
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
abstract class BaseE2ETest {

	static final Path SCREENSHOTS_DIR = Path.of("target/screenshots");

	private static final String AUTH_HEADER = "Basic "
			+ java.util.Base64.getEncoder().encodeToString("admin:admin".getBytes());

	private static final int SEED_MAX_ATTEMPTS = 3;

	private boolean previousTestFailed = false;

	@RegisterExtension
	TestWatcher failureWatcher = new TestWatcher() {
		@Override
		public void testFailed(ExtensionContext context, Throwable cause) {
			BaseE2ETest.this.previousTestFailed = true;
			String testName = context.getDisplayName().replaceAll("[^a-zA-Z0-9_-]", "_");
			if (BaseE2ETest.this.page != null) {
				BaseE2ETest.this.page.screenshot(
						new Page.ScreenshotOptions().setPath(SCREENSHOTS_DIR.resolve("FAILED-" + testName + ".png"))
							.setFullPage(true));
				try {
					Files.writeString(SCREENSHOTS_DIR.resolve("FAILED-" + testName + "-url.txt"),
							BaseE2ETest.this.page.url());
				}
				catch (IOException ex) {
					// best-effort — ignore
				}
			}
		}
	};

	Playwright playwright;

	Browser browser;

	BrowserContext browserContext;

	Page page;

	APIRequestContext apiContext;

	String baseUrl;

	String wiremockUrl;

	String wiremockInternalUrl;

	@BeforeAll
	void setUpPlaywright() throws IOException {
		Files.createDirectories(SCREENSHOTS_DIR);

		this.baseUrl = SharedContainers.BROKER_URL;
		this.wiremockUrl = SharedContainers.WIREMOCK_URL;
		this.wiremockInternalUrl = SharedContainers.WIREMOCK_INTERNAL_URL;

		this.playwright = Playwright.create();
		this.browser = this.playwright.chromium().launch(new BrowserType.LaunchOptions().setHeadless(true));
		this.browserContext = this.browser.newContext();
		this.browserContext.setExtraHTTPHeaders(Map.of("Authorization", AUTH_HEADER));
		this.page = this.browserContext.newPage();
		this.page.addInitScript("window.__BROKER_AUTH__ = 'admin:admin';");

		this.apiContext = this.playwright.request()
			.newContext(new APIRequest.NewContextOptions().setBaseURL(this.baseUrl)
				.setExtraHTTPHeaders(Map.of("Authorization", AUTH_HEADER)));

	}

	@AfterAll
	void tearDownPlaywright() {
		if (this.apiContext != null) {
			this.apiContext.dispose();
		}
		if (this.browserContext != null) {
			this.browserContext.close();
		}
		if (this.browser != null) {
			this.browser.close();
		}
		if (this.playwright != null) {
			this.playwright.close();
		}
	}

	void assumePriorTestsPassed() {
		Assumptions.assumeFalse(this.previousTestFailed, "Skipped because a prior ordered test failed");
	}

	void navigateTo(String path) {
		this.page.navigate(this.baseUrl + path);
		this.page.waitForLoadState(LoadState.NETWORKIDLE);
	}

	void screenshot(String name) {
		this.page
			.screenshot(new Page.ScreenshotOptions().setPath(SCREENSHOTS_DIR.resolve(name + ".png")).setFullPage(true));
	}

	void seedApp(String name, String owner) {
		APIResponse response = seedWithRetry(() -> this.apiContext.post("/api/v1/applications",
				RequestOptions.create()
					.setHeader("Content-Type", "application/json")
					.setData(Map.of("name", name, "description", "E2E test application: " + name, "owner", owner))));
		assertThat(response.status()).as("Seed app %s", name).isIn(200, 201, 409);
	}

	void seedContract(String app, String version, String contractName, String content) {
		APIResponse response = seedWithRetry(
				() -> this.apiContext.post("/api/v1/applications/" + app + "/versions/" + version + "/contracts",
						RequestOptions.create()
							.setHeader("Content-Type", "application/json")
							.setData(Map.of("contractName", contractName, "content", content, "contentType",
									"application/x-spring-cloud-contract+yaml"))));
		// 409 tolerated so re-seeding the same contract (on a surefire/CI rerun) is
		// idempotent.
		assertThat(response.status()).as("Seed contract %s for %s@%s", contractName, app, version).isIn(200, 201, 409);
	}

	void seedVerification(String provider, String pVersion, String consumer, String cVersion, String status) {
		APIResponse response = seedWithRetry(() -> this.apiContext.post("/api/v1/verifications",
				RequestOptions.create()
					.setHeader("Content-Type", "application/json")
					.setData(Map.of("providerName", provider, "providerVersion", pVersion, "consumerName", consumer,
							"consumerVersion", cVersion, "status", status))));
		// 409 tolerated so re-seeding the same verification (on a rerun) is idempotent.
		assertThat(response.status()).as("Seed verification %s->%s %s", provider, consumer, status).isIn(200, 201, 409);
	}

	void seedEnvironment(String name, String description, int displayOrder, boolean production) {
		APIResponse response = seedWithRetry(() -> this.apiContext.post("/api/v1/environments",
				RequestOptions.create()
					.setHeader("Content-Type", "application/json")
					.setData(Map.of("name", name, "description", description, "displayOrder", displayOrder,
							"production", production))));
		assertThat(response.status()).as("Seed environment %s", name).isIn(200, 201, 409);
	}

	void seedDeployment(String app, String version, String environment) {
		APIResponse response = seedWithRetry(
				() -> this.apiContext.post("/api/v1/environments/" + environment + "/deployments",
						RequestOptions.create()
							.setHeader("Content-Type", "application/json")
							.setData(Map.of("applicationName", app, "version", version))));
		// 409 tolerated so re-seeding the same deployment (on a rerun) is idempotent.
		assertThat(response.status()).as("Seed deployment %s@%s to %s", app, version, environment).isIn(200, 201, 409);
	}

	void seedTag(String app, String version, String tag) {
		APIResponse response = seedWithRetry(
				() -> this.apiContext.put("/api/v1/applications/" + app + "/versions/" + version + "/tags/" + tag,
						RequestOptions.create().setHeader("Content-Type", "application/json")));
		assertThat(response.status()).as("Seed tag %s for %s@%s", tag, app, version).isIn(200, 201, 409);
	}

	/**
	 * Runs a seed request, retrying on a transient failure — a thrown Playwright error or
	 * a {@code 5xx} response — with a short linear backoff. The broker/DB can be slow to
	 * accept writes right after the containers come up, which surfaced as flaky seed
	 * failures. Non-{@code 5xx} responses (including the {@code 409} that idempotent
	 * re-seeds return) are handed straight back to the caller's own status assertion.
	 * @param call the seed request to run
	 * @return the last response received (for the caller to assert on)
	 */
	private APIResponse seedWithRetry(Supplier<APIResponse> call) {
		APIResponse response = null;
		RuntimeException lastError = null;
		for (int attempt = 1; attempt <= SEED_MAX_ATTEMPTS; attempt++) {
			try {
				response = call.get();
				if (response.status() < 500) {
					return response;
				}
			}
			catch (PlaywrightException ex) {
				lastError = ex;
			}
			if (attempt < SEED_MAX_ATTEMPTS) {
				sleepQuietly(1000L * attempt);
			}
		}
		if (response != null) {
			return response;
		}
		throw (lastError != null) ? lastError : new IllegalStateException("Seed request failed with no response");
	}

	private static void sleepQuietly(long millis) {
		try {
			Thread.sleep(millis);
		}
		catch (InterruptedException ex) {
			Thread.currentThread().interrupt();
		}
	}

	Locator waitForHeading(String text) {
		Locator heading = this.page.locator("[data-testid='page-heading']:has-text('" + text + "')");
		waitForFirstWithReload(heading);
		return heading;
	}

	Locator waitForTable() {
		Locator table = this.page.locator("[data-testid='data-table']");
		waitForFirstWithReload(table);
		return table.first();
	}

	/**
	 * Waits for the first matching element; on the first timeout, reloads the page once
	 * and waits again. The SPA occasionally renders its shell before the data behind a
	 * view has loaded (especially right after seeding), which surfaced as flaky 120s
	 * timeouts. The total wait budget is unchanged (2 x 60s), but a reload recovers a
	 * stuck first render instead of blocking the whole budget on it.
	 * @param locator the target locator (its {@code first()} is awaited)
	 */
	private void waitForFirstWithReload(Locator locator) {
		try {
			locator.first().waitFor(new Locator.WaitForOptions().setTimeout(60_000));
		}
		catch (PlaywrightException ex) {
			this.page.reload();
			this.page.waitForLoadState(LoadState.NETWORKIDLE);
			locator.first().waitFor(new Locator.WaitForOptions().setTimeout(60_000));
		}
	}

	Locator waitForText(String text) {
		Locator locator = this.page.locator("text=" + text);
		locator.first().waitFor(new Locator.WaitForOptions().setTimeout(120_000));
		return locator;
	}

	void clickAndWaitForApi(Locator element, String urlContains) {
		this.page.waitForResponse(response -> response.url().contains(urlContains), () -> element.click());
	}

	void clickSidebar(String label) {
		this.page.locator("nav a:has-text('" + label + "')").first().evaluate("el => el.click()");
		this.page.waitForLoadState(LoadState.NETWORKIDLE);
	}

	/**
	 * Select a value from a ComboBox component (text input + dropdown listbox). Finds the
	 * nth text input on the page (0-indexed), clicks to open the dropdown, types to
	 * filter, then clicks the matching option.
	 */
	void selectComboBox(int index, String value) {
		selectComboBox("input[type='text']", index, value);
	}

	/**
	 * Select a value from a ComboBox within a specific CSS scope (e.g. "form
	 * input[type='text']").
	 */
	void selectComboBox(String selector, int index, String value) {
		Locator inputs = this.page.locator(selector);
		Locator input = inputs.nth(index);
		input.waitFor(new Locator.WaitForOptions().setTimeout(60_000));
		input.click();
		input.fill(value);
		// Wait for dropdown option to appear and click it
		Locator option = this.page.locator("[role='listbox'] [role='option']:has-text('" + value + "')");
		option.first().waitFor(new Locator.WaitForOptions().setTimeout(60_000));
		option.first().click();
		this.page.locator("[role='listbox']")
			.first()
			.waitFor(new Locator.WaitForOptions().setState(WaitForSelectorState.HIDDEN).setTimeout(5000));
	}

}
