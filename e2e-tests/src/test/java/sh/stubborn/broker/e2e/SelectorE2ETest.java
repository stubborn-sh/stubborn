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
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * E2E tests for the Consumer Version Selectors page. Uses "sel-" prefix for data
 * isolation.
 */
class SelectorE2ETest extends BaseE2ETest {

	private static final String PROVIDER = "sel-order-service";

	private static final String CONSUMER = "sel-payment-service";

	private static final String VERSION = "1.0.0";

	private static final String CONSUMER_VERSION = "2.0.0";

	@Test
	@Order(1)
	void should_display_selectors_page() {
		// given
		seedApp(PROVIDER, "sel-team");
		seedApp(CONSUMER, "sel-team");
		seedContract(PROVIDER, VERSION, "sel-get-order", "request:\n  method: GET\n  url: /orders/1");
		seedVerification(PROVIDER, VERSION, CONSUMER, CONSUMER_VERSION, "SUCCESS");

		// when
		navigateTo("/selectors");
		waitForHeading("Consumer Version Selectors");

		// then — form is visible
		Locator modeSelect = this.page.locator("#selector-mode");
		modeSelect.waitFor(new Locator.WaitForOptions().setTimeout(30000));
		assertThat(modeSelect.isVisible()).isTrue();

		screenshot("sel-01-selectors-page");
	}

	@Test
	@Order(2)
	void should_resolve_main_branch_selectors() {
		assumePriorTestsPassed();
		// given
		navigateTo("/selectors");
		waitForHeading("Consumer Version Selectors");

		// when — select Main Branch mode and submit
		Locator modeSelect = this.page.locator("#selector-mode");
		modeSelect.waitFor(new Locator.WaitForOptions().setTimeout(30000));
		modeSelect.selectOption("mainBranch");

		Locator resolveButton = this.page.locator("button:has-text('Resolve Selectors')");
		resolveButton.click();

		// then — results section appears
		Locator results = this.page.locator("text=Results").or(this.page.locator("text=contract"));
		results.first().waitFor(new Locator.WaitForOptions().setTimeout(30000));

		screenshot("sel-02-selectors-main-branch-result");
	}

	@Test
	@Order(3)
	void should_show_consumer_name_field_in_consumer_mode() {
		assumePriorTestsPassed();
		// given
		navigateTo("/selectors");
		waitForHeading("Consumer Version Selectors");

		// when — select Consumer mode
		Locator modeSelect = this.page.locator("#selector-mode");
		modeSelect.waitFor(new Locator.WaitForOptions().setTimeout(30000));
		modeSelect.selectOption("consumer");

		// then — consumer name field appears
		Locator consumerInput = this.page.locator("#selector-consumer");
		consumerInput.waitFor(new Locator.WaitForOptions().setTimeout(30000));
		assertThat(consumerInput.isVisible()).isTrue();

		screenshot("sel-03-selectors-consumer-mode");
	}

}
