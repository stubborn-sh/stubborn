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
 * E2E tests for smart navigation, clickable verifications, and interactive dependency
 * graph. Uses "sn-" prefix for data isolation.
 */
class SmartNavigationE2ETest extends BaseE2ETest {

	private static final String PROVIDER = "sn-order-service";

	private static final String CONSUMER = "sn-payment-service";

	private static final String VERSION = "1.0.0";

	private static final String CONSUMER_VERSION = "2.0.0";

	@Test
	@Order(1)
	void should_seed_test_data() {
		// given — seed apps, contract, verification
		seedApp(PROVIDER, "sn-team");
		seedApp(CONSUMER, "sn-team");
		seedContract(PROVIDER, VERSION, "get-order", "request:\n  method: GET\n  url: /orders/1");
		seedVerification(PROVIDER, VERSION, CONSUMER, CONSUMER_VERSION, "SUCCESS");
	}

	@Test
	@Order(2)
	void should_navigate_to_applications_with_search_param_and_auto_expand() {
		assumePriorTestsPassed();
		// when — navigate to applications with search param
		navigateTo("/applications?search=" + PROVIDER);

		// then — search input is populated
		Locator searchInput = this.page.locator("input[placeholder='Search applications...']");
		searchInput.waitFor(new Locator.WaitForOptions().setTimeout(30000));
		assertThat(searchInput.inputValue()).isEqualTo(PROVIDER);

		// then — app detail is auto-expanded (shows Published Versions)
		Locator detail = this.page.locator("text=Published Versions");
		detail.first().waitFor(new Locator.WaitForOptions().setTimeout(30000));
		assertThat(detail.count()).isGreaterThan(0);

		screenshot("sn-01-app-auto-expand");
	}

	@Test
	@Order(3)
	void should_click_dashboard_verification_row_and_navigate_with_search() {
		assumePriorTestsPassed();
		// given — go to dashboard, wait for recent verifications
		navigateTo("/dashboard");
		waitForHeading("Dashboard");
		Locator providerText = this.page.locator("text=" + PROVIDER);
		providerText.first().waitFor(new Locator.WaitForOptions().setTimeout(30000));

		// when — click the verification row (the outer clickable div)
		Locator row = this.page.locator("[class*='cursor-pointer']:has-text('" + PROVIDER + "')");
		row.first().click();
		this.page.waitForURL("**/verifications?search=" + PROVIDER.replace("-", "\\-"));

		// then — navigated to verifications with search param
		assertThat(this.page.url()).contains("/verifications?search=");

		// then — search input is populated with provider name
		Locator searchInput = this.page.locator("input[placeholder='Search verifications...']");
		searchInput.waitFor(new Locator.WaitForOptions().setTimeout(30000));
		assertThat(searchInput.inputValue()).isEqualTo(PROVIDER);

		screenshot("sn-02-verification-search");
	}

	@Test
	@Order(4)
	void should_show_graph_view_by_default_with_toggle() {
		assumePriorTestsPassed();
		// when
		navigateTo("/graph");
		waitForHeading("Dependencies");

		// then — Graph/Table toggle buttons exist
		Locator graphTab = this.page.locator("button[role='tab']:has-text('Graph')");
		graphTab.waitFor(new Locator.WaitForOptions().setTimeout(30000));
		assertThat(graphTab.getAttribute("aria-selected")).isEqualTo("true");

		Locator tableTab = this.page.locator("button[role='tab']:has-text('Table')");
		assertThat(tableTab.getAttribute("aria-selected")).isEqualTo("false");

		// then — graph container is rendered
		Locator graphContainer = this.page.locator("[data-testid='dependency-graph']");
		graphContainer.waitFor(new Locator.WaitForOptions().setTimeout(30000));
		assertThat(graphContainer.count()).isGreaterThan(0);

		screenshot("sn-03-graph-view");
	}

	@Test
	@Order(5)
	void should_switch_to_table_view() {
		assumePriorTestsPassed();
		// given
		navigateTo("/graph");
		waitForHeading("Dependencies");

		// when — click Table tab
		Locator tableTab = this.page.locator("button[role='tab']:has-text('Table')");
		tableTab.waitFor(new Locator.WaitForOptions().setTimeout(30000));
		tableTab.click();

		// then — table is rendered with edges
		waitForTable();
		Locator providerHeader = this.page.locator("th:has-text('Provider')");
		assertThat(providerHeader.count()).isGreaterThan(0);

		screenshot("sn-04-table-view");
	}

	@Test
	@Order(6)
	void should_persist_table_view_in_url() {
		assumePriorTestsPassed();
		// when — navigate directly with ?view=table
		navigateTo("/graph?view=table");
		waitForHeading("Dependencies");

		// then — table is rendered
		waitForTable();
		Locator tableTab = this.page.locator("button[role='tab']:has-text('Table')");
		assertThat(tableTab.getAttribute("aria-selected")).isEqualTo("true");

		screenshot("sn-05-table-view-url");
	}

}
