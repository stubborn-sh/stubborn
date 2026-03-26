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

import com.microsoft.playwright.Locator;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * E2E tests for the Applications feature: registration, browsing, search, detail
 * click-through, and version badges. Uses "app-" prefix for data isolation.
 */
class ApplicationFlowE2ETest extends BaseE2ETest {

	private static final String APP_ORDER = "app-order-service";

	private static final String APP_PAYMENT = "app-payment-service";

	@Test
	@Order(1)
	void should_display_applications_list() {
		// given
		seedApp(APP_ORDER, "app-team");
		seedApp(APP_PAYMENT, "app-team");

		// when
		navigateTo("/applications");

		// then
		waitForTable();
		waitForText(APP_ORDER);
		Locator paymentApp = waitForText(APP_PAYMENT);
		assertThat(paymentApp.count()).isGreaterThan(0);

		screenshot("app-01-list");
	}

	@Test
	@Order(2)
	void should_search_applications() {
		assumePriorTestsPassed();
		// given
		navigateTo("/applications");
		waitForTable();

		// when — type in search box
		Locator searchInput = this.page.locator("input[placeholder*='Search']").first();
		searchInput.waitFor(new Locator.WaitForOptions().setTimeout(30000));
		searchInput.fill("order");

		// then — only order-service should match (server-side search triggers API call)
		Locator orderRow = this.page.locator("td:has-text('" + APP_ORDER + "')");
		orderRow.first().waitFor(new Locator.WaitForOptions().setTimeout(30000));
		assertThat(orderRow.count()).isGreaterThan(0);

		screenshot("app-02-search");
	}

	@Test
	@Order(3)
	void should_expand_application_details() {
		assumePriorTestsPassed();
		// given
		navigateTo("/applications");
		waitForTable();

		// when — click app name button to expand details
		Locator appNameButton = this.page.locator("button:has-text('" + APP_ORDER + "')");
		appNameButton.first().waitFor(new Locator.WaitForOptions().setTimeout(30000));
		appNameButton.first().click();

		// then — detail card shows description and owner
		Locator detailCard = this.page.locator("text=app-team");
		detailCard.first().waitFor(new Locator.WaitForOptions().setTimeout(30000));
		assertThat(detailCard.count()).isGreaterThan(0);

		screenshot("app-03-detail");
	}

	@Test
	@Order(4)
	void should_show_published_versions() {
		assumePriorTestsPassed();
		// given — seed contracts for multiple versions
		seedContract(APP_ORDER, "1.0.0", "get-order-v1", "request:\n  method: GET\n  url: /orders/1");
		seedContract(APP_ORDER, "2.0.0", "get-order-v2", "request:\n  method: GET\n  url: /orders/2");

		// when
		navigateTo("/applications");
		waitForTable();
		Locator appNameButton = this.page.locator("button:has-text('" + APP_ORDER + "')");
		appNameButton.first().waitFor(new Locator.WaitForOptions().setTimeout(30000));
		appNameButton.first().click();

		// then — version badges appear
		Locator versionBadge = this.page.locator("text=1.0.0");
		versionBadge.first().waitFor(new Locator.WaitForOptions().setTimeout(30000));
		assertThat(versionBadge.count()).isGreaterThan(0);

		screenshot("app-04-versions");
	}

	@Test
	@Order(5)
	void should_navigate_to_contracts_from_version_badge() {
		assumePriorTestsPassed();
		// given
		navigateTo("/applications");
		waitForTable();
		Locator appNameButton = this.page.locator("button:has-text('" + APP_ORDER + "')");
		appNameButton.first().waitFor(new Locator.WaitForOptions().setTimeout(30000));
		appNameButton.first().click();

		// when — click version badge (rendered as <button> wrapping <Badge>)
		// Wait for "Published Versions" section to load
		this.page.locator("text=Published Versions").first().waitFor(new Locator.WaitForOptions().setTimeout(30000));
		// The version badge buttons contain the version number text
		Locator versionBadgeButton = this.page.locator("button:has-text('1.0.0')").last();
		versionBadgeButton.waitFor(new Locator.WaitForOptions().setTimeout(30000));
		versionBadgeButton.click();
		this.page.waitForURL("**/contracts**");

		// then — navigated to contracts page with query params
		assertThat(this.page.url()).contains("/contracts");

		screenshot("app-05-navigate-contracts");
	}

}
