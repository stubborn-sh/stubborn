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
import java.time.Duration;
import java.util.Map;

import com.microsoft.playwright.APIRequestContext;
import com.microsoft.playwright.APIResponse;
import com.microsoft.playwright.Locator;
import com.microsoft.playwright.options.RequestOptions;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;

/**
 * E2E tests for Webhooks: create webhook via UI, trigger event, verify round-trip
 * delivery via WireMock, check execution history. Uses "whk-" prefix for data isolation.
 */
class WebhookRoundTripE2ETest extends BaseE2ETest {

	private static final String APP_NAME = "whk-order-service";

	private static final String VERSION = "1.0.0";

	private static final String WEBHOOK_PATH = "/webhook-callback";

	private APIRequestContext wiremockApiContext;

	@Override
	@BeforeAll
	void setUpPlaywright() throws IOException {
		super.setUpPlaywright();
		this.wiremockApiContext = this.playwright.request()
			.newContext(new com.microsoft.playwright.APIRequest.NewContextOptions().setBaseURL(this.wiremockUrl));
	}

	@Override
	@AfterAll
	void tearDownPlaywright() {
		if (this.wiremockApiContext != null) {
			this.wiremockApiContext.dispose();
		}
		super.tearDownPlaywright();
	}

	@Test
	@Order(1)
	void should_create_webhook_via_api_and_verify_in_ui() {
		// given — seed app and register a WireMock stub for webhook callback
		seedApp(APP_NAME, "whk-team");
		registerWireMockStub();

		// Create webhook via API (more reliable than UI form for test setup)
		this.apiContext.post("/api/v1/webhooks", RequestOptions.create()
			.setHeader("Content-Type", "application/json")
			.setData(Map.of("eventType", "CONTRACT_PUBLISHED", "url", this.wiremockInternalUrl + WEBHOOK_PATH)));

		// when — navigate to webhooks page
		navigateTo("/webhooks");
		waitForHeading("Webhooks");

		// then — webhook appears in table
		waitForTable();
		Locator webhookUrl = waitForText(WEBHOOK_PATH);
		assertThat(webhookUrl.count()).isGreaterThan(0);

		screenshot("whk-01-webhook-created");
	}

	@Test
	@Order(2)
	void should_verify_webhook_delivery_after_contract_publish() {
		assumePriorTestsPassed();
		// given — clear WireMock request journal before triggering
		resetWireMockRequests();
		registerWireMockStub();

		// when — publish a contract (triggers CONTRACT_PUBLISHED event)
		seedContract(APP_NAME, VERSION, "get-order-whk", "request:\n  method: GET\n  url: /orders/webhook-test");

		// then — poll WireMock for up to 30 seconds for the webhook delivery
		awaitWireMockRequest(30);

		screenshot("whk-02-delivery-verified");
	}

	@Test
	@Order(3)
	void should_show_execution_history_in_ui() {
		assumePriorTestsPassed();
		// when — navigate to webhooks and look for execution details
		navigateTo("/webhooks");
		waitForHeading("Webhooks");
		waitForTable();

		// Click Details button
		Locator detailsButton = this.page.locator("button:has-text('Details')");
		detailsButton.first().waitFor(new Locator.WaitForOptions().setTimeout(30000));
		detailsButton.first().click();

		// then — execution history visible (status code badge)
		Locator statusBadge = this.page.locator("text=200");
		statusBadge.first().waitFor(new Locator.WaitForOptions().setTimeout(30000));
		assertThat(statusBadge.count()).isGreaterThan(0);

		screenshot("whk-03-execution-history");
	}

	@Test
	@Order(4)
	void should_delete_webhook() {
		assumePriorTestsPassed();
		// given
		navigateTo("/webhooks");
		waitForHeading("Webhooks");
		waitForTable();

		// when — click Delete button
		Locator deleteButton = this.page.locator("button:has-text('Delete')");
		deleteButton.first().waitFor(new Locator.WaitForOptions().setTimeout(30000));
		deleteButton.first().click();

		// Confirm deletion
		Locator confirmButton = this.page.locator("button:has-text('Confirm')");
		confirmButton.first().waitFor(new Locator.WaitForOptions().setTimeout(5000));
		confirmButton.first().click();

		// then — wait for webhook to disappear after server-side refetch
		Locator webhookUrl = this.page.locator("text=" + WEBHOOK_PATH);
		webhookUrl.first()
			.waitFor(new Locator.WaitForOptions().setState(com.microsoft.playwright.options.WaitForSelectorState.HIDDEN)
				.setTimeout(30000));
		assertThat(webhookUrl.count()).isEqualTo(0);

		screenshot("whk-04-deleted");
	}

	@Test
	@Order(5)
	void should_create_webhook_via_ui_form() {
		assumePriorTestsPassed();
		// given — navigate to webhooks page
		navigateTo("/webhooks");
		waitForHeading("Webhooks");

		// when — click Create Webhook button
		Locator createButton = this.page.locator("button:has-text('Create Webhook')");
		createButton.first().waitFor(new Locator.WaitForOptions().setTimeout(30000));
		createButton.first().click();

		// Fill form — event type defaults to CONTRACT_PUBLISHED (first option)
		Locator urlInput = this.page.locator("input[type='url']");
		urlInput.waitFor(new Locator.WaitForOptions().setTimeout(30000));
		urlInput.fill(this.wiremockInternalUrl + "/webhook-ui-test");

		// Submit
		Locator submitButton = this.page.locator("button:has-text('Create')");
		submitButton.first().click();

		// then — new webhook appears in the table
		Locator webhookUrl = waitForText("/webhook-ui-test");
		assertThat(webhookUrl.count()).isGreaterThan(0);

		screenshot("whk-05-ui-form-create");
	}

	@Test
	@Order(6)
	void should_filter_webhooks_by_url() {
		assumePriorTestsPassed();
		// given — webhooks page already has at least one webhook from prior tests
		navigateTo("/webhooks");
		waitForHeading("Webhooks");
		waitForTable();

		// when — type a search term in the URL filter
		Locator searchInput = this.page.locator("input[placeholder='Search webhooks...']");
		searchInput.waitFor(new Locator.WaitForOptions().setTimeout(30000));
		searchInput.fill("webhook-ui-test");

		// then — only matching webhook visible (server-side search triggers API call)
		Locator match = this.page.locator("td:has-text('webhook-ui-test')");
		match.first().waitFor(new Locator.WaitForOptions().setTimeout(30000));
		assertThat(match.count()).isGreaterThan(0);

		screenshot("whk-06-url-filter");
	}

	private void registerWireMockStub() {
		String stubMapping = """
				{
				  "request": {
				    "method": "POST",
				    "urlPath": "%s"
				  },
				  "response": {
				    "status": 200,
				    "body": "OK"
				  }
				}
				""".formatted(WEBHOOK_PATH);
		this.wiremockApiContext.post("/__admin/mappings",
				RequestOptions.create().setHeader("Content-Type", "application/json").setData(stubMapping));
	}

	private void resetWireMockRequests() {
		this.wiremockApiContext.delete("/__admin/requests");
	}

	private void awaitWireMockRequest(int timeoutSeconds) {
		await().atMost(Duration.ofSeconds(timeoutSeconds)).pollInterval(Duration.ofSeconds(1)).untilAsserted(() -> {
			APIResponse response = this.wiremockApiContext.get("/__admin/requests?urlPathPattern=" + WEBHOOK_PATH);
			String body = response.text();
			// Verify at least one request was received
			assertThat(body).doesNotContain("\"total\" : 0").doesNotContain("\"total\":0");
			// Verify payload contains expected event data
			assertThat(body).contains("CONTRACT_PUBLISHED");
			assertThat(body).contains(APP_NAME);
		});
	}

}
