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

import com.microsoft.playwright.APIResponse;
import com.microsoft.playwright.Locator;
import com.microsoft.playwright.options.WaitForSelectorState;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * E2E tests for the Dependency Graph feature: seed verifications, browse graph, click app
 * nodes, view edges. Uses "grp-" prefix for data isolation.
 */
class DependencyGraphE2ETest extends BaseE2ETest {

	private static final String APP_A = "grp-order-service";

	private static final String APP_B = "grp-payment-service";

	private static final String APP_C = "grp-inventory-service";

	private static final String VERSION = "1.0.0";

	@Test
	@Order(1)
	void should_display_dependency_graph() {
		// given — seed 3 apps with verifications between them
		seedApp(APP_A, "grp-team");
		seedApp(APP_B, "grp-team");
		seedApp(APP_C, "grp-team");
		seedContract(APP_A, VERSION, "get-order", "request:\n  method: GET\n  url: /orders/1");
		seedContract(APP_C, VERSION, "get-inventory", "request:\n  method: GET\n  url: /inventory/1");
		seedVerification(APP_A, VERSION, APP_B, VERSION, "SUCCESS");
		seedVerification(APP_C, VERSION, APP_B, VERSION, "SUCCESS");

		// when
		navigateTo("/graph?view=table");

		// then — heading visible
		waitForHeading("Dependencies");

		// Node buttons rendered for all apps involved
		Locator appAButton = this.page.locator("button:has-text('" + APP_A + "')");
		appAButton.first().waitFor(new Locator.WaitForOptions().setTimeout(60000));
		assertThat(appAButton.count()).isGreaterThan(0);

		Locator appBButton = this.page.locator("button:has-text('" + APP_B + "')");
		assertThat(appBButton.count()).isGreaterThan(0);

		// Table with edges visible
		waitForTable();

		// Verify graph API returns correct edges
		APIResponse graphResponse = this.apiContext.get("/api/v1/graph");
		assertThat(graphResponse.status()).isEqualTo(200);
		String graphBody = graphResponse.text();
		// Check that the seeded edges are present in the response
		assertThat(graphBody).contains("\"providerName\":\"" + APP_A + "\"");
		assertThat(graphBody).contains("\"consumerName\":\"" + APP_B + "\"");
		assertThat(graphBody).contains("\"status\":\"SUCCESS\"");

		screenshot("grp-01-graph");
	}

	@Test
	@Order(2)
	void should_click_app_node_for_detail() {
		assumePriorTestsPassed();
		// given
		navigateTo("/graph?view=table");
		waitForHeading("Dependencies");

		// when — click app node
		Locator appButton = this.page.locator("button:has-text('" + APP_B + "')");
		appButton.first().waitFor(new Locator.WaitForOptions().setTimeout(60000));
		appButton.first().click();

		// then — detail view with heading
		Locator appHeading = this.page.locator("h3:has-text('" + APP_B + "')");
		appHeading.waitFor(new Locator.WaitForOptions().setTimeout(30000));
		assertThat(appHeading.count()).isGreaterThan(0);

		// Consumer lists (APP_B depends on APP_A and APP_C as providers)
		Locator providerText = this.page.locator("text=providers");
		providerText.first().waitFor(new Locator.WaitForOptions().setTimeout(30000));

		screenshot("grp-02-app-detail");
	}

	@Test
	@Order(3)
	void should_filter_edges_by_search() {
		assumePriorTestsPassed();
		// given
		navigateTo("/graph?view=table");
		waitForHeading("Dependencies");
		waitForTable();

		// when — type search term in filter
		Locator searchInput = this.page.locator("input[placeholder='Filter by app name...']");
		searchInput.waitFor(new Locator.WaitForOptions().setTimeout(30000));
		searchInput.fill(APP_A);

		// then — edges involving APP_A are visible
		Locator appAText = this.page.locator("td:has-text('" + APP_A + "')");
		appAText.first().waitFor(new Locator.WaitForOptions().setTimeout(30000));
		assertThat(appAText.count()).isGreaterThan(0);

		screenshot("grp-03-search-filter");
	}

	@Test
	@Order(4)
	void should_show_empty_state_for_unknown_search() {
		assumePriorTestsPassed();
		// given
		navigateTo("/graph?view=table");
		waitForHeading("Dependencies");
		waitForTable();

		// when — type a search term that matches nothing
		Locator searchInput = this.page.locator("input[placeholder='Filter by app name...']");
		searchInput.waitFor(new Locator.WaitForOptions().setTimeout(30000));
		searchInput.fill("nonexistent-service-xyz-12345");

		// then — empty state message (DataTable shows "No data available")
		Locator emptyState = this.page.locator("text=No data available");
		emptyState.first().waitFor(new Locator.WaitForOptions().setTimeout(30000));
		assertThat(emptyState.count()).isGreaterThan(0);

		screenshot("grp-04-empty-state");
	}

	@Test
	@Order(5)
	void should_clear_selection() {
		assumePriorTestsPassed();
		// given — navigate to graph and select an app
		navigateTo("/graph?view=table");
		waitForHeading("Dependencies");
		Locator appButton = this.page.locator("button:has-text('" + APP_A + "')");
		appButton.first().waitFor(new Locator.WaitForOptions().setTimeout(60000));
		appButton.first().click();

		Locator appHeading = this.page.locator("h3:has-text('" + APP_A + "')");
		appHeading.waitFor(new Locator.WaitForOptions().setTimeout(30000));

		// when — click Clear selection
		Locator clearButton = this.page.locator("button:has-text('Clear selection')");
		clearButton.first().click();

		// then — detail view hidden, back to overview
		Locator h3 = this.page.locator("h3:has-text('" + APP_A + "')");
		h3.waitFor(new Locator.WaitForOptions().setState(WaitForSelectorState.HIDDEN).setTimeout(30000));
		assertThat(h3.count()).isEqualTo(0);

		screenshot("grp-03-cleared");
	}

	@Test
	@Order(6)
	void should_return_response_for_unknown_app_in_graph() {
		// when
		APIResponse response = this.apiContext.get("/api/v1/graph/applications/nonexistent-app-xyz-99999");
		// then — should return 200 with empty data or 404
		assertThat(response.status()).isIn(200, 404);
		if (response.status() == 200) {
			String body = response.text();
			assertThat(body).contains("\"providers\":[]").contains("\"consumers\":[]");
		}
	}

}
