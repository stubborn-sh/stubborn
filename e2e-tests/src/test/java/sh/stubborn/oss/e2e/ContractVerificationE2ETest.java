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
 * E2E tests for Contracts and Verifications features: publish contracts (simulating Maven
 * plugin), browse, view content, record verifications, check results. Uses "ver-" prefix
 * for data isolation.
 */
class ContractVerificationE2ETest extends BaseE2ETest {

	private static final String PROVIDER = "ver-order-service";

	private static final String CONSUMER = "ver-payment-service";

	private static final String VERSION = "1.0.0";

	private static final String CONSUMER_VERSION = "2.0.0";

	@Test
	@Order(1)
	void should_display_contracts_after_publishing() {
		// given — seed app + contract via API (simulating Maven plugin)
		seedApp(PROVIDER, "ver-team");
		seedContract(PROVIDER, VERSION, "get-order",
				"request:\n  method: GET\n  url: /orders/1\nresponse:\n  status: 200");

		// when
		navigateTo("/contracts");

		// then — heading visible
		waitForHeading("Contracts");

		// Select the application from ComboBox dropdown
		selectComboBox(0, PROVIDER);

		// Select version from ComboBox dropdown
		selectComboBox(1, VERSION);

		// Contract should appear in table
		waitForTable();
		Locator contractName = waitForText("get-order");
		assertThat(contractName.count()).isGreaterThan(0);

		screenshot("ver-01-contracts");
	}

	@Test
	@Order(2)
	void should_expand_contract_content() {
		assumePriorTestsPassed();
		// given
		navigateTo("/contracts");
		selectComboBox(0, PROVIDER);
		selectComboBox(1, VERSION);
		waitForTable();

		// when — click contract name to expand details
		Locator contractButton = this.page.locator("button:has-text('get-order')");
		contractButton.first().waitFor(new Locator.WaitForOptions().setTimeout(30000));
		contractButton.first().click();

		// then — content is visible
		Locator content = this.page.locator("text=GET");
		content.first().waitFor(new Locator.WaitForOptions().setTimeout(30000));
		assertThat(content.count()).isGreaterThan(0);

		screenshot("ver-02-contract-content");
	}

	@Test
	@Order(3)
	void should_switch_to_metadata_tab() {
		assumePriorTestsPassed();
		// given — navigate to contracts and expand a contract
		navigateTo("/contracts");
		selectComboBox(0, PROVIDER);
		selectComboBox(1, VERSION);
		waitForTable();

		Locator contractButton = this.page.locator("button:has-text('get-order')");
		contractButton.first().waitFor(new Locator.WaitForOptions().setTimeout(30000));
		contractButton.first().click();

		// when — click the Metadata tab
		Locator metadataTab = this.page.locator("button:has-text('Metadata')");
		metadataTab.first().waitFor(new Locator.WaitForOptions().setTimeout(30000));
		metadataTab.first().click();

		// then — metadata fields visible (Name, Content Type, Created)
		Locator nameLabel = this.page.locator("text=Content Type");
		nameLabel.first().waitFor(new Locator.WaitForOptions().setTimeout(30000));
		assertThat(nameLabel.count()).isGreaterThan(0);

		screenshot("ver-03-metadata-tab");
	}

	@Test
	@Order(4)
	void should_display_verification_results() {
		assumePriorTestsPassed();
		// given — seed consumer + SUCCESS verification
		seedApp(CONSUMER, "ver-team");
		seedVerification(PROVIDER, VERSION, CONSUMER, CONSUMER_VERSION, "SUCCESS");

		// when
		navigateTo("/verifications");

		// then
		waitForTable();
		Locator successBadge = waitForText("SUCCESS");
		assertThat(successBadge.count()).isGreaterThan(0);

		screenshot("ver-03-verifications");
	}

	@Test
	@Order(5)
	void should_show_multiple_verifications() {
		assumePriorTestsPassed();
		// given — seed FAILED verification
		seedVerification(PROVIDER, VERSION, CONSUMER, "3.0.0", "FAILED");

		// when
		navigateTo("/verifications");

		// then — both SUCCESS and FAILED appear
		waitForTable();
		Locator failedBadge = waitForText("FAILED");
		failedBadge.first().waitFor(new Locator.WaitForOptions().setTimeout(30000));
		assertThat(failedBadge.count()).isGreaterThan(0);

		Locator successBadge = this.page.locator("text=SUCCESS");
		assertThat(successBadge.count()).isGreaterThan(0);

		screenshot("ver-04-multiple-verifications");
	}

	@Test
	@Order(6)
	void should_display_provider_and_consumer_in_table() {
		assumePriorTestsPassed();
		// given
		navigateTo("/verifications");

		// when
		waitForTable();

		// then — both provider and consumer names visible in table cells
		Locator providerText = this.page.locator("text=" + PROVIDER);
		providerText.first().waitFor(new Locator.WaitForOptions().setTimeout(30000));
		assertThat(providerText.count()).isGreaterThan(0);

		Locator consumerText = this.page.locator("text=" + CONSUMER);
		assertThat(consumerText.count()).isGreaterThan(0);

		screenshot("ver-05-table-data");
	}

}
