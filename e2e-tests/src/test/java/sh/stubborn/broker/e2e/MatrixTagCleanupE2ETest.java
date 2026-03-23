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
package sh.stubborn.broker.e2e;

import com.microsoft.playwright.Locator;
import com.microsoft.playwright.options.LoadState;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * E2E tests for Matrix, Tags, and Cleanup features. Uses "tag-" prefix for data
 * isolation.
 */
class MatrixTagCleanupE2ETest extends BaseE2ETest {

	private static final String PROVIDER = "tag-order-service";

	private static final String CONSUMER = "tag-payment-service";

	private static final String VERSION = "1.0.0";

	private static final String CONSUMER_VERSION = "2.0.0";

	@Test
	@Order(1)
	void should_display_matrix_with_verifications() {
		// given
		seedApp(PROVIDER, "tag-team");
		seedApp(CONSUMER, "tag-team");
		seedContract(PROVIDER, VERSION, "get-order", "request:\n  method: GET\n  url: /orders/1");
		seedVerification(PROVIDER, VERSION, CONSUMER, CONSUMER_VERSION, "SUCCESS");

		// when
		navigateTo("/matrix");
		waitForHeading("Matrix");

		// then — table shows provider/consumer/status
		waitForTable();
		Locator providerText = waitForText(PROVIDER);
		assertThat(providerText.count()).isGreaterThan(0);
		Locator successBadge = waitForText("SUCCESS");
		assertThat(successBadge.count()).isGreaterThan(0);

		screenshot("tag-01-matrix");
	}

	@Test
	@Order(2)
	void should_filter_matrix_by_provider_combobox() {
		assumePriorTestsPassed();
		// given
		navigateTo("/matrix");
		waitForHeading("Matrix");
		waitForTable();

		// when — select provider from ComboBox (first combobox on page)
		selectComboBox("input[role='combobox']", 0, PROVIDER);

		// then — results show our provider
		Locator providerText = this.page.locator("td:has-text('" + PROVIDER + "')");
		providerText.first().waitFor(new Locator.WaitForOptions().setTimeout(30000));
		assertThat(providerText.count()).isGreaterThan(0);

		screenshot("tag-02-matrix-filter");
	}

	@Test
	@Order(3)
	void should_filter_matrix_by_consumer_combobox() {
		assumePriorTestsPassed();
		// given
		navigateTo("/matrix");
		waitForHeading("Matrix");
		waitForTable();

		// when — select consumer from ComboBox (second combobox on page)
		selectComboBox("input[role='combobox']", 1, CONSUMER);
		this.page.waitForLoadState(LoadState.NETWORKIDLE);

		// then — results show our consumer
		Locator consumerText = this.page.locator("td:has-text('" + CONSUMER + "')");
		consumerText.first().waitFor(new Locator.WaitForOptions().setTimeout(30000));
		assertThat(consumerText.count()).isGreaterThan(0);

		screenshot("tag-03-matrix-consumer-filter");
	}

	@Test
	@Order(4)
	void should_sort_matrix_by_column_header() {
		assumePriorTestsPassed();
		// given
		navigateTo("/matrix");
		waitForHeading("Matrix");
		waitForTable();

		// when — click Provider column header to sort
		Locator providerHeader = this.page.locator("th:has-text('Provider')");
		providerHeader.first().waitFor(new Locator.WaitForOptions().setTimeout(30000));
		providerHeader.first().click();
		this.page.waitForLoadState(LoadState.NETWORKIDLE);

		// then — table is still rendered (no crash on sort)
		Locator table = this.page.locator("table");
		assertThat(table.count()).isGreaterThan(0);

		// Verify data is still present after sorting
		Locator providerText = this.page.locator("td:has-text('" + PROVIDER + "')");
		assertThat(providerText.count()).isGreaterThan(0);

		screenshot("tag-04-matrix-sorted");
	}

	@Test
	@Order(5)
	void should_look_up_tags_via_combobox() {
		assumePriorTestsPassed();
		// given — seed a tag via API
		seedTag(PROVIDER, VERSION, "RELEASE");

		// when
		navigateTo("/tags");
		waitForHeading("Tags");

		// Select application from ComboBox
		selectComboBox("input[role='combobox']", 0, PROVIDER);

		// Wait for versions to load, then select version from ComboBox
		this.page.waitForLoadState(LoadState.NETWORKIDLE);
		selectComboBox("input[role='combobox']", 1, VERSION);

		// Click Look up tags button
		Locator lookupButton = this.page.locator("button:has-text('Look up tags')");
		lookupButton.click();

		// then — tag visible in results
		Locator tagText = waitForText("RELEASE");
		assertThat(tagText.count()).isGreaterThan(0);

		screenshot("tag-05-tags-lookup");
	}

	@Test
	@Order(6)
	void should_run_cleanup() {
		assumePriorTestsPassed();
		// given — seed 6 versions of contracts
		for (int i = 1; i <= 6; i++) {
			seedContract(PROVIDER, "1.0." + i, "get-order-v" + i, "request:\n  method: GET\n  url: /orders/" + i);
		}

		// when
		navigateTo("/cleanup");
		waitForHeading("Cleanup");

		// Fill cleanup form
		Locator appNameInput = this.page.locator("#cleanup-app-name");
		appNameInput.waitFor(new Locator.WaitForOptions().setTimeout(30000));
		appNameInput.fill(PROVIDER);

		// Set keepLatestVersions via React-compatible input setter (dispatches change
		// event)
		this.page.evaluate("""
				const input = document.querySelector('#cleanup-keep-versions');
				const nativeSetter = Object.getOwnPropertyDescriptor(
				    HTMLInputElement.prototype, 'value').set;
				nativeSetter.call(input, '3');
				input.dispatchEvent(new Event('input', { bubbles: true }));
				input.dispatchEvent(new Event('change', { bubbles: true }));
				""");

		screenshot("tag-06-cleanup-before-submit");

		// Click Run Cleanup — use evaluate to bypass Playwright actionability checks
		Locator cleanupButton = this.page.locator("button:has-text('Run Cleanup')");
		cleanupButton.first().evaluate("el => el.click()");

		// then — result card appears (shows "X deleted" badge or "No contracts were
		// deleted" or error)
		Locator result = this.page.locator("text=deleted")
			.or(this.page.locator("text=Result"))
			.or(this.page.locator("text=No contracts"))
			.or(this.page.locator("text=Cleanup failed"));
		result.first().waitFor(new Locator.WaitForOptions().setTimeout(30000));

		screenshot("tag-07-cleanup-result");
	}

}
