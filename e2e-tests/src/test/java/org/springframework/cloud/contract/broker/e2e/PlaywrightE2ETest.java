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
package org.springframework.cloud.contract.broker.e2e;

import java.util.Map;

import com.microsoft.playwright.Locator;
import com.microsoft.playwright.options.RequestOptions;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Original browser-based E2E tests for the React UI. Refactored to use shared containers
 * and base test infrastructure. Uses "ui-" prefix for data isolation.
 */
class PlaywrightE2ETest extends BaseE2ETest {

	private static final String APP_NAME = "ui-order-service";

	private static final String CONSUMER_NAME = "ui-payment-service";

	private static final String VERSION = "1.0.0";

	private static final String CONSUMER_VERSION = "2.0.0";

	private static final String ENVIRONMENT = "ui-staging";

	@Test
	@Order(1)
	void should_display_dashboard() {
		// when
		navigateTo("/dashboard");

		// then
		assertThat(this.page.title()).isNotEmpty();
		Locator heading = waitForHeading("Dashboard");
		assertThat(heading.count()).isGreaterThan(0);

		screenshot("legacy-01-dashboard");
	}

	@Test
	@Order(2)
	void should_display_applications_after_seeding() {
		assumePriorTestsPassed();
		// given
		this.apiContext.post("/api/v1/applications",
				RequestOptions.create()
					.setHeader("Content-Type", "application/json")
					.setData(Map.of("name", APP_NAME, "description", "UI test application", "owner", "ui-team")));

		// when
		navigateTo("/applications");

		// then
		waitForTable();
		Locator appName = waitForText(APP_NAME);
		assertThat(appName.count()).isGreaterThan(0);

		screenshot("legacy-02-applications");
	}

	@Test
	@Order(3)
	void should_display_contracts_page() {
		assumePriorTestsPassed();
		// given
		this.apiContext.post("/api/v1/applications/" + APP_NAME + "/versions/" + VERSION + "/contracts",
				RequestOptions.create()
					.setHeader("Content-Type", "application/json")
					.setData(Map.of("contractName", "get-order", "content", "request:\n  method: GET\n  url: /orders/1",
							"contentType", "application/x-spring-cloud-contract+yaml")));

		// when
		navigateTo("/contracts");

		// then
		Locator heading = waitForHeading("Contracts");
		assertThat(heading.count()).isGreaterThan(0);

		screenshot("legacy-03-contracts");
	}

	@Test
	@Order(4)
	void should_display_verifications_page() {
		assumePriorTestsPassed();
		// given
		this.apiContext.post("/api/v1/applications",
				RequestOptions.create()
					.setHeader("Content-Type", "application/json")
					.setData(Map.of("name", CONSUMER_NAME, "description", "UI test consumer", "owner", "ui-team")));
		seedVerification(APP_NAME, VERSION, CONSUMER_NAME, CONSUMER_VERSION, "SUCCESS");

		// when
		navigateTo("/verifications");

		// then
		waitForTable();
		Locator successBadge = waitForText("SUCCESS");
		assertThat(successBadge.count()).isGreaterThan(0);

		screenshot("legacy-04-verifications");
	}

	@Test
	@Order(5)
	void should_display_environments_page() {
		assumePriorTestsPassed();
		// given
		seedDeployment(CONSUMER_NAME, CONSUMER_VERSION, ENVIRONMENT);

		// when
		navigateTo("/environments");

		// then
		Locator heading = waitForHeading("Environments");
		assertThat(heading.count()).isGreaterThan(0);

		screenshot("legacy-05-environments");
	}

	@Test
	@Order(6)
	void should_navigate_via_sidebar() {
		assumePriorTestsPassed();
		// when
		navigateTo("/dashboard");
		this.page.locator("nav a:has-text('Applications')").first().click();
		this.page.waitForURL("**/applications");
		this.page.waitForLoadState();

		// then
		assertThat(this.page.url()).endsWith("/applications");

		this.page.locator("h2").first().waitFor();
		clickSidebar("Verifications");
		this.page.waitForURL("**/verifications");

		assertThat(this.page.url()).endsWith("/verifications");

		screenshot("legacy-06-navigation");
	}

	@Test
	@Order(7)
	void should_display_graph_page() {
		assumePriorTestsPassed();
		// when
		navigateTo("/graph?view=table");

		// then
		Locator heading = waitForHeading("Dependencies");
		assertThat(heading.count()).isGreaterThan(0);

		Locator appButton = this.page.locator("button:has-text('" + APP_NAME + "')");
		appButton.first().waitFor(new Locator.WaitForOptions().setTimeout(60000));
		assertThat(appButton.count()).isGreaterThan(0);

		waitForTable();
		Locator successBadge = waitForText("SUCCESS");
		assertThat(successBadge.count()).isGreaterThan(0);

		screenshot("legacy-07-graph");
	}

	@Test
	@Order(8)
	void should_display_app_dependencies_on_graph_page() {
		assumePriorTestsPassed();
		// given
		navigateTo("/graph?view=table");

		// when
		Locator appButton = this.page.locator("button:has-text('" + APP_NAME + "')");
		appButton.first().waitFor(new Locator.WaitForOptions().setTimeout(60000));
		appButton.first().click();

		// then
		Locator appHeading = this.page.locator("h3:has-text('" + APP_NAME + "')");
		appHeading.waitFor(new Locator.WaitForOptions().setTimeout(30000));
		assertThat(appHeading.count()).isGreaterThan(0);

		Locator clearButton = this.page.locator("button:has-text('Clear selection')");
		assertThat(clearButton.count()).isGreaterThan(0);

		screenshot("legacy-08-graph-app-detail");
	}

	@Test
	@Order(9)
	void should_take_page_screenshots() {
		assumePriorTestsPassed();
		String[] paths = { "/dashboard", "/applications", "/contracts", "/verifications", "/environments",
				"/can-i-deploy", "/graph" };
		for (String path : paths) {
			navigateTo(path);
			String name = "legacy-09-full-" + path.substring(1);
			screenshot(name);
		}
	}

}
