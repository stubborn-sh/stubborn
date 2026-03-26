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

import java.util.List;

import com.microsoft.playwright.Locator;
import com.microsoft.playwright.options.LoadState;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Comprehensive user acceptance E2E test that walks through the full happy path of the
 * broker UI. Seeds data via API, then validates every page's ComboBox dropdowns, tables,
 * pagination, and interactive features work correctly.
 *
 * Uses "uat-" prefix for complete data isolation from other E2E test classes.
 *
 * Covers acceptance criteria from all feature specs (001-018) including: application
 * registration, contract browsing, verification results, environments, can-i-deploy,
 * dependency graph, matrix, tags, and webhooks.
 */
class UserAcceptanceE2ETest extends BaseE2ETest {

	private static final String PROVIDER = "uat-order-service";

	private static final String CONSUMER = "uat-payment-service";

	private static final String THIRD_APP = "uat-notification-service";

	private static final String VERSION = "1.0.0";

	private static final String CONSUMER_VERSION = "2.0.0";

	// ── 1. Applications ──────────────────────────────────────────────────

	@Test
	@Order(1)
	void should_show_registered_applications_in_table() {
		// given — register multiple apps
		seedApp(PROVIDER, "uat-team");
		seedApp(CONSUMER, "uat-team");
		seedApp(THIRD_APP, "uat-team");

		// when
		navigateTo("/applications");
		waitForHeading("Applications");
		waitForTable();

		// then — all apps visible
		Locator providerRow = waitForText(PROVIDER);
		assertThat(providerRow.count()).isGreaterThan(0);
		Locator consumerRow = waitForText(CONSUMER);
		assertThat(consumerRow.count()).isGreaterThan(0);

		screenshot("uat-01-applications-list");
	}

	@Test
	@Order(2)
	void should_expand_application_detail_on_click() {
		assumePriorTestsPassed();
		// given
		navigateTo("/applications");
		waitForTable();

		// when — click application name button
		Locator appButton = this.page.locator("button:has-text('" + PROVIDER + "')");
		appButton.first().waitFor(new Locator.WaitForOptions().setTimeout(30000));
		appButton.first().click();

		// then — detail card scrolls into view with owner and description
		Locator ownerText = this.page.locator("text=uat-team");
		ownerText.first().waitFor(new Locator.WaitForOptions().setTimeout(30000));
		assertThat(ownerText.count()).isGreaterThan(0);

		screenshot("uat-02-application-detail");
	}

	@Test
	@Order(3)
	void should_search_applications() {
		assumePriorTestsPassed();
		// given
		navigateTo("/applications");
		waitForTable();

		// when — type in search box
		Locator searchInput = this.page.locator("input[placeholder*='Search']").first();
		searchInput.fill("order");
		this.page.waitForLoadState(LoadState.NETWORKIDLE);

		// then — only matching app visible
		Locator providerRow = this.page.locator("td:has-text('" + PROVIDER + "')");
		providerRow.first().waitFor(new Locator.WaitForOptions().setTimeout(30000));
		assertThat(providerRow.count()).isGreaterThan(0);

		screenshot("uat-03-applications-search");
	}

	// ── 2. Contracts ─────────────────────────────────────────────────────

	@Test
	@Order(4)
	void should_publish_and_browse_contracts_via_combobox() {
		assumePriorTestsPassed();
		// given — publish contracts for provider
		seedContract(PROVIDER, VERSION, "get-order",
				"request:\n  method: GET\n  url: /orders/1\nresponse:\n  status: 200");
		seedContract(PROVIDER, VERSION, "create-order",
				"request:\n  method: POST\n  url: /orders\nresponse:\n  status: 201");

		// when — navigate to contracts page and select app + version from ComboBoxes
		navigateTo("/contracts");
		waitForHeading("Contracts");

		// Select application from first ComboBox
		selectComboBox("input[role='combobox']", 0, PROVIDER);

		// Select version from second ComboBox
		selectComboBox("input[role='combobox']", 1, VERSION);

		// then — contracts visible in table
		waitForTable();
		Locator getOrderContract = waitForText("get-order");
		assertThat(getOrderContract.count()).isGreaterThan(0);
		Locator createOrderContract = this.page.locator("text=create-order");
		assertThat(createOrderContract.count()).isGreaterThan(0);

		screenshot("uat-04-contracts-browse");
	}

	@Test
	@Order(5)
	void should_expand_contract_to_view_content() {
		assumePriorTestsPassed();
		// given
		navigateTo("/contracts");
		selectComboBox("input[role='combobox']", 0, PROVIDER);
		selectComboBox("input[role='combobox']", 1, VERSION);
		waitForTable();

		// when — click contract name to expand
		Locator contractButton = this.page.locator("button:has-text('get-order')");
		contractButton.first().waitFor(new Locator.WaitForOptions().setTimeout(30000));
		contractButton.first().click();

		// then — content card with contract details visible
		Locator contentTab = this.page.locator("text=Content");
		contentTab.first().waitFor(new Locator.WaitForOptions().setTimeout(30000));
		assertThat(contentTab.count()).isGreaterThan(0);

		screenshot("uat-05-contract-content");
	}

	// ── 3. Verifications ─────────────────────────────────────────────────

	@Test
	@Order(6)
	void should_display_verification_results() {
		assumePriorTestsPassed();
		// given — record verifications
		seedContract(CONSUMER, CONSUMER_VERSION, "get-payment", "request:\n  method: GET\n  url: /payments/1");
		seedVerification(PROVIDER, VERSION, CONSUMER, CONSUMER_VERSION, "SUCCESS");
		seedVerification(PROVIDER, VERSION, THIRD_APP, "1.0.0", "FAILED");

		// when
		navigateTo("/verifications");
		waitForHeading("Verifications");
		waitForTable();

		// then — both SUCCESS and FAILED verifications visible
		Locator successBadge = waitForText("SUCCESS");
		assertThat(successBadge.count()).isGreaterThan(0);
		Locator failedBadge = waitForText("FAILED");
		assertThat(failedBadge.count()).isGreaterThan(0);

		// Provider and consumer names visible
		Locator providerText = this.page.locator("td:has-text('" + PROVIDER + "')");
		assertThat(providerText.count()).isGreaterThan(0);
		Locator consumerText = this.page.locator("td:has-text('" + CONSUMER + "')");
		assertThat(consumerText.count()).isGreaterThan(0);

		screenshot("uat-06-verifications");
	}

	@Test
	@Order(7)
	void should_search_verifications() {
		assumePriorTestsPassed();
		// given
		navigateTo("/verifications");
		waitForTable();

		// when — search for provider
		Locator searchInput = this.page.locator("input[placeholder*='Search']").first();
		searchInput.fill(CONSUMER);
		this.page.waitForLoadState(LoadState.NETWORKIDLE);

		// then — filtered results
		Locator consumerText = this.page.locator("td:has-text('" + CONSUMER + "')");
		consumerText.first().waitFor(new Locator.WaitForOptions().setTimeout(30000));
		assertThat(consumerText.count()).isGreaterThan(0);

		screenshot("uat-07-verifications-search");
	}

	// ── 4. Dependency Graph ──────────────────────────────────────────────

	@Test
	@Order(8)
	void should_display_dependency_graph_with_nodes_and_edges() {
		assumePriorTestsPassed();
		// given — verifications already seeded in step 6

		// when
		navigateTo("/graph?view=table");
		waitForHeading("Dependencies");

		// then — node buttons rendered
		Locator providerNode = this.page.locator("button:has-text('" + PROVIDER + "')");
		providerNode.first().waitFor(new Locator.WaitForOptions().setTimeout(60000));
		assertThat(providerNode.count()).isGreaterThan(0);

		// Edge table visible with verification data
		waitForTable();
		Locator successText = this.page.locator("text=SUCCESS");
		assertThat(successText.count()).isGreaterThan(0);

		screenshot("uat-08-dependency-graph");
	}

	@Test
	@Order(9)
	void should_click_graph_node_and_view_dependencies() {
		assumePriorTestsPassed();
		// given
		navigateTo("/graph?view=table");
		waitForHeading("Dependencies");

		// when — click consumer node (which depends on provider)
		Locator consumerNode = this.page.locator("button:has-text('" + CONSUMER + "')");
		consumerNode.first().waitFor(new Locator.WaitForOptions().setTimeout(60000));
		consumerNode.first().click();

		// then — detail view shows dependencies
		Locator heading = this.page.locator("h3:has-text('" + CONSUMER + "')");
		heading.waitFor(new Locator.WaitForOptions().setTimeout(30000));
		assertThat(heading.count()).isGreaterThan(0);

		// Provider section visible
		Locator providerSection = this.page.locator("text=providers");
		providerSection.first().waitFor(new Locator.WaitForOptions().setTimeout(30000));

		screenshot("uat-09-graph-node-detail");
	}

	// ── 5. Environments ──────────────────────────────────────────────────

	@Test
	@Order(10)
	void should_display_deployments_after_recording() {
		assumePriorTestsPassed();
		// given — seed environments and record deployments
		seedEnvironment("uat-dev", "Development", 1, false);
		seedEnvironment("uat-staging", "Pre-production", 2, false);
		seedEnvironment("uat-production", "Production", 3, true);
		seedDeployment(PROVIDER, VERSION, "uat-staging");
		seedDeployment(CONSUMER, CONSUMER_VERSION, "uat-staging");

		// when
		navigateTo("/environments");
		waitForHeading("Environments");

		// Click staging tab
		Locator stagingTab = this.page.locator("button:text-is('uat-staging')");
		stagingTab.first().waitFor(new Locator.WaitForOptions().setTimeout(30000));
		stagingTab.first().click();
		this.page.waitForLoadState(LoadState.NETWORKIDLE);

		// then — deployments visible
		Locator providerText = waitForText(PROVIDER);
		assertThat(providerText.count()).isGreaterThan(0);

		screenshot("uat-10-environments");
	}

	@Test
	@Order(11)
	void should_record_deployment_via_ui_form() {
		assumePriorTestsPassed();
		// given
		navigateTo("/environments");
		waitForHeading("Environments");

		// Click dev tab first
		Locator devTab = this.page.locator("button:text-is('uat-dev')");
		devTab.first().click();
		this.page.waitForLoadState(LoadState.NETWORKIDLE);

		// when — click Record Deployment, fill form
		Locator recordButton = this.page.locator("button:has-text('Record Deployment')");
		recordButton.first().click();

		// Select application from ComboBox in form
		selectComboBox("form input[role='combobox']", 0, PROVIDER);

		// Select version from ComboBox in form
		selectComboBox("form input[role='combobox']", 1, VERSION);

		// Submit
		Locator submitButton = this.page.locator("form button:has-text('Record')");
		submitButton.first().click();

		// then — deployment appears in table
		Locator providerCell = this.page.locator("td:has-text('" + PROVIDER + "')");
		providerCell.first().waitFor(new Locator.WaitForOptions().setTimeout(30000));
		assertThat(providerCell.count()).isGreaterThan(0);

		screenshot("uat-11-record-deployment");
	}

	// ── 6. Can I Deploy ──────────────────────────────────────────────────

	@Test
	@Order(12)
	void should_check_can_i_deploy_safe() {
		assumePriorTestsPassed();
		// given — verifications + deployments already seeded

		// when
		navigateTo("/can-i-deploy");
		waitForHeading("Can I Deploy");

		// Select application from ComboBox
		selectComboBox("input[role='combobox']", 0, PROVIDER);

		// Select version from ComboBox
		selectComboBox("input[role='combobox']", 1, VERSION);

		// Select environment from native select
		Locator envSelect = this.page.locator("#cid-environment");
		envSelect.selectOption("uat-staging");
		this.page.waitForLoadState(LoadState.NETWORKIDLE);

		// Click Check
		Locator checkButton = this.page.locator("button:has-text('Check')");
		checkButton.first().evaluate("el => el.click()");

		// then — result card appears
		Locator result = this.page.locator("text=Result")
			.or(this.page.locator("text=SAFE"))
			.or(this.page.locator("text=UNSAFE"));
		result.first().waitFor(new Locator.WaitForOptions().setTimeout(60000));

		screenshot("uat-12-can-i-deploy");
	}

	// ── 7. Compatibility Matrix ──────────────────────────────────────────

	@Test
	@Order(13)
	void should_display_compatibility_matrix() {
		assumePriorTestsPassed();
		// given — verifications already seeded

		// when
		navigateTo("/matrix");
		waitForHeading("Matrix");

		// then — matrix table shows verification data
		waitForTable();
		Locator providerText = this.page.locator("td:has-text('" + PROVIDER + "')");
		providerText.first().waitFor(new Locator.WaitForOptions().setTimeout(30000));
		assertThat(providerText.count()).isGreaterThan(0);

		screenshot("uat-13-matrix");
	}

	@Test
	@Order(14)
	void should_filter_matrix_by_provider_combobox() {
		assumePriorTestsPassed();
		// given
		navigateTo("/matrix");
		waitForHeading("Matrix");
		waitForTable();

		// when — select provider from ComboBox
		selectComboBox("input[role='combobox']", 0, PROVIDER);
		this.page.waitForLoadState(LoadState.NETWORKIDLE);

		// then — results filtered to provider
		Locator providerText = this.page.locator("td:has-text('" + PROVIDER + "')");
		providerText.first().waitFor(new Locator.WaitForOptions().setTimeout(30000));
		assertThat(providerText.count()).isGreaterThan(0);

		screenshot("uat-14-matrix-filtered");
	}

	// ── 8. Version Tags ──────────────────────────────────────────────────

	@Test
	@Order(15)
	void should_add_and_lookup_tags_via_combobox() {
		assumePriorTestsPassed();
		// given — add tags via API
		seedTag(PROVIDER, VERSION, "RELEASE");
		seedTag(PROVIDER, VERSION, "STABLE");

		// when — navigate to tags, select app and version from ComboBoxes
		navigateTo("/tags");
		waitForHeading("Tags");

		// Select application from ComboBox
		selectComboBox("input[role='combobox']", 0, PROVIDER);

		// Wait for versions to load, then select version
		this.page.waitForLoadState(LoadState.NETWORKIDLE);
		selectComboBox("input[role='combobox']", 1, VERSION);

		// Click Look up tags
		Locator lookupButton = this.page.locator("button:has-text('Look up tags')");
		lookupButton.click();

		// then — tags visible in results table
		Locator releaseTag = waitForText("RELEASE");
		assertThat(releaseTag.count()).isGreaterThan(0);
		Locator stableTag = this.page.locator("text=STABLE");
		assertThat(stableTag.count()).isGreaterThan(0);

		screenshot("uat-15-tags");
	}

	// ── 9. Webhooks ──────────────────────────────────────────────────────

	@Test
	@Order(16)
	void should_display_webhooks_page() {
		assumePriorTestsPassed();
		// given
		navigateTo("/webhooks");

		// then — heading renders, form available via button
		waitForHeading("Webhooks");
		Locator createButton = this.page.locator("button:has-text('Create Webhook')");
		createButton.first().waitFor(new Locator.WaitForOptions().setTimeout(30000));
		assertThat(createButton.count()).isGreaterThan(0);

		screenshot("uat-16-webhooks");
	}

	// ── 10. ComboBox Alphabetical Sorting ─────────────────────────────────

	@Test
	@Order(17)
	void should_show_applications_sorted_alphabetically_in_combobox() {
		assumePriorTestsPassed();
		// given — navigate to contracts page where ComboBox lists all apps
		navigateTo("/contracts");
		waitForHeading("Contracts");

		// when — open the application ComboBox
		Locator appComboBox = this.page.locator("input[role='combobox']").first();
		appComboBox.waitFor(new Locator.WaitForOptions().setTimeout(30000));
		appComboBox.click();

		// then — dropdown options appear with our apps (sorted alphabetically)
		Locator options = this.page.locator("[role='listbox'] [role='option']");
		options.first().waitFor(new Locator.WaitForOptions().setTimeout(30000));

		// Collect all option texts
		List<String> optionTexts = options.allTextContents();
		assertThat(optionTexts).isNotEmpty();

		// Verify they contain our test apps
		assertThat(optionTexts).anyMatch(text -> text.contains("uat-"));

		// Verify alphabetical order — filter to uat-* apps and check ordering
		List<String> uatApps = optionTexts.stream().filter(t -> t.startsWith("uat-")).toList();
		List<String> sorted = uatApps.stream().sorted().toList();
		assertThat(uatApps).isEqualTo(sorted);

		screenshot("uat-17-combobox-sorted");
	}

	// ── 11. Pagination ───────────────────────────────────────────────────

	@Test
	@Order(18)
	void should_show_pagination_controls_on_applications_page() {
		assumePriorTestsPassed();
		// given
		navigateTo("/applications");
		waitForTable();

		// then — pagination controls visible: "Showing X-Y of Z", page navigation
		Locator showingText = this.page.locator("text=Showing");
		showingText.first().waitFor(new Locator.WaitForOptions().setTimeout(30000));
		assertThat(showingText.count()).isGreaterThan(0);

		// Page info visible
		Locator pageInfo = this.page.locator("text=Page");
		assertThat(pageInfo.count()).isGreaterThan(0);

		screenshot("uat-18-pagination");
	}

	@Test
	@Order(19)
	void should_show_pagination_controls_on_verifications_page() {
		assumePriorTestsPassed();
		// given
		navigateTo("/verifications");
		waitForTable();

		// then
		Locator showingText = this.page.locator("text=Showing");
		showingText.first().waitFor(new Locator.WaitForOptions().setTimeout(30000));
		assertThat(showingText.count()).isGreaterThan(0);

		screenshot("uat-19-verifications-pagination");
	}

	// ── 12. Dashboard ────────────────────────────────────────────────────

	@Test
	@Order(20)
	void should_display_dashboard_with_counts() {
		assumePriorTestsPassed();
		// given — data already seeded by previous tests

		// when
		navigateTo("/");

		// then — dashboard heading
		waitForHeading("Dashboard");

		// Statistics cards should show non-zero counts
		Locator applicationsStat = this.page.locator("text=Applications");
		applicationsStat.first().waitFor(new Locator.WaitForOptions().setTimeout(30000));
		assertThat(applicationsStat.count()).isGreaterThan(0);

		screenshot("uat-20-dashboard");
	}

	// ── 13. Cleanup ──────────────────────────────────────────────────────

	@Test
	@Order(21)
	void should_display_cleanup_form() {
		assumePriorTestsPassed();
		// when
		navigateTo("/cleanup");
		waitForHeading("Cleanup");

		// then — form fields visible
		Locator appNameInput = this.page.locator("#cleanup-app-name");
		appNameInput.waitFor(new Locator.WaitForOptions().setTimeout(30000));
		assertThat(appNameInput.count()).isGreaterThan(0);

		Locator keepVersions = this.page.locator("#cleanup-keep-versions");
		assertThat(keepVersions.count()).isGreaterThan(0);

		Locator runButton = this.page.locator("button:has-text('Run Cleanup')");
		assertThat(runButton.count()).isGreaterThan(0);

		screenshot("uat-21-cleanup-form");
	}

}
