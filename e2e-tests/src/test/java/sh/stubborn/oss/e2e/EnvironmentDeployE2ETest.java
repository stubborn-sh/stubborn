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
import com.microsoft.playwright.options.LoadState;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * E2E tests for Environments and Can-I-Deploy features: record deployments, switch
 * environment tabs, run deployment safety checks. Uses "env-" prefix for data isolation.
 * Seeds environments via API since the UI loads them dynamically.
 */
class EnvironmentDeployE2ETest extends BaseE2ETest {

	private static final String PROVIDER = "env-order-service";

	private static final String CONSUMER = "env-payment-service";

	private static final String NOTIF_SERVICE = "env-notification-service";

	private static final String VERSION = "1.0.0";

	private static final String CONSUMER_VERSION = "2.0.0";

	private static final String NOTIF_VERSION = "3.0.0";

	private static final String STAGING = "env-staging";

	private static final String DEV = "env-dev";

	@Test
	@Order(1)
	void should_display_deployments_after_recording() {
		// given — seed environments, apps, contracts (both provider and consumer need
		// versions), and deployment
		seedEnvironment(DEV, "Development", 1, false);
		seedEnvironment(STAGING, "Pre-production", 2, false);
		seedApp(PROVIDER, "env-team");
		seedApp(CONSUMER, "env-team");
		seedContract(PROVIDER, VERSION, "get-order", "request:\n  method: GET\n  url: /orders/1");
		seedContract(CONSUMER, CONSUMER_VERSION, "get-payment", "request:\n  method: GET\n  url: /payments/1");
		seedDeployment(PROVIDER, VERSION, STAGING);

		// when
		navigateTo("/environments");
		waitForHeading("Environments");

		// Click the staging tab (hardcoded env tabs)
		Locator stagingTab = this.page.locator("button:text-is('" + STAGING + "')");
		stagingTab.first().waitFor(new Locator.WaitForOptions().setTimeout(30000));
		stagingTab.first().click();
		this.page.waitForLoadState(LoadState.NETWORKIDLE);

		// then — deployment should be visible
		Locator providerText = waitForText(PROVIDER);
		assertThat(providerText.count()).isGreaterThan(0);

		screenshot("env-01-deployments");
	}

	@Test
	@Order(2)
	void should_switch_environment_tabs() {
		assumePriorTestsPassed();
		// given
		navigateTo("/environments");
		waitForHeading("Environments");

		// when — click dev tab, then switch to staging
		Locator devTab = this.page.locator("button:text-is('" + DEV + "')");
		devTab.first().waitFor(new Locator.WaitForOptions().setTimeout(30000));
		devTab.first().click();
		this.page.waitForLoadState(LoadState.NETWORKIDLE);

		// Click staging tab and wait for deployment API response
		this.page.waitForResponse(
				response -> response.url().contains("/api/v1/environments/" + STAGING + "/deployments"), () -> {
					Locator stagingTab = this.page.locator("button:text-is('" + STAGING + "')");
					stagingTab.first().click();
				});
		this.page.waitForLoadState(LoadState.NETWORKIDLE);

		// then — verify staging deployment present
		Locator providerInStaging = waitForText(PROVIDER);
		assertThat(providerInStaging.count()).isGreaterThan(0);

		screenshot("env-02-switch-tabs");
	}

	@Test
	@Order(3)
	void should_record_deployment_via_ui_form() {
		assumePriorTestsPassed();
		// given — navigate to environments page
		navigateTo("/environments");
		waitForHeading("Environments");

		// when — click Record Deployment button
		Locator recordButton = this.page.locator("button:has-text('Record Deployment')");
		recordButton.first().waitFor(new Locator.WaitForOptions().setTimeout(30000));
		recordButton.first().click();

		// Fill form — select application from ComboBox
		selectComboBox("form input[type='text']", 0, CONSUMER);

		// Select version from ComboBox
		selectComboBox("form input[type='text']", 1, CONSUMER_VERSION);

		// Submit
		Locator submitButton = this.page.locator("button:has-text('Record')");
		submitButton.first().click();

		// then — deployment appears in table
		Locator consumerText = this.page.locator("td:has-text('" + CONSUMER + "')");
		consumerText.first().waitFor(new Locator.WaitForOptions().setTimeout(30000));
		assertThat(consumerText.count()).isGreaterThan(0);

		screenshot("env-03-ui-form-deploy");
	}

	@Test
	@Order(4)
	void should_check_can_i_deploy_safe() {
		assumePriorTestsPassed();
		// given — SUCCESS verification exists so provider is safe to deploy
		seedVerification(PROVIDER, VERSION, CONSUMER, CONSUMER_VERSION, "SUCCESS");
		seedDeployment(CONSUMER, CONSUMER_VERSION, STAGING);

		// when
		performCanIDeploy(PROVIDER, VERSION, STAGING);

		// then — result must be SAFE
		waitForText("SAFE");

		screenshot("env-04-can-i-deploy-safe");
	}

	@Test
	@Order(5)
	void should_check_can_i_deploy_unsafe() {
		assumePriorTestsPassed();
		// given — FAILED verification for a different consumer means provider is UNSAFE
		seedApp(NOTIF_SERVICE, "env-team");
		seedContract(NOTIF_SERVICE, NOTIF_VERSION, "get-notification",
				"request:\n  method: GET\n  url: /notifications/1");
		seedVerification(PROVIDER, VERSION, NOTIF_SERVICE, NOTIF_VERSION, "FAILED");
		seedDeployment(NOTIF_SERVICE, NOTIF_VERSION, STAGING);

		// when
		performCanIDeploy(PROVIDER, VERSION, STAGING);

		// then — result must be UNSAFE
		waitForText("UNSAFE");

		screenshot("env-05-can-i-deploy-unsafe");
	}

	@Test
	@Order(6)
	void should_check_can_i_deploy_no_consumers() {
		assumePriorTestsPassed();
		// given — CONSUMER itself has no consumers depending on it, so it is SAFE

		// when
		performCanIDeploy(CONSUMER, CONSUMER_VERSION, STAGING);

		// then — no consumers means SAFE
		waitForText("SAFE");

		screenshot("env-06-can-i-deploy-no-consumers");
	}

	@Test
	@Order(7)
	void should_return_error_for_unknown_app_in_can_i_deploy() {
		// given — environment exists (seeded in @Order(1))
		seedEnvironment(STAGING, "Pre-production", 2, false);
		// when — can-i-deploy for non-existent app
		APIResponse response = this.apiContext
			.get("/api/v1/can-i-deploy?application=nonexistent-app-xyz&version=1.0.0&environment=" + STAGING);
		// then
		assertThat(response.status()).isIn(400, 404);
	}

	private void performCanIDeploy(String app, String version, String environment) {
		navigateTo("/can-i-deploy");
		waitForHeading("Can I Deploy");
		selectComboBox(0, app);
		selectComboBox(1, version);
		Locator envSelect = this.page.locator("#cid-environment");
		envSelect.selectOption(environment);
		this.page.waitForLoadState(LoadState.NETWORKIDLE);
		Locator checkButton = this.page.locator("button:has-text('Check')");
		checkButton.first().evaluate("el => el.click()");
	}

}
