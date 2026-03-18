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

import com.microsoft.playwright.Locator;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * E2E tests for Navigation, Settings, and Dashboard features: sidebar nav, dark mode
 * toggle, dashboard stats, settings page. Uses "nav-" prefix for data isolation.
 */
class NavigationSettingsE2ETest extends BaseE2ETest {

	@Test
	@Order(1)
	void should_display_dashboard_stats() {
		// when
		navigateTo("/dashboard");

		// then
		Locator heading = waitForHeading("Dashboard");
		assertThat(heading.count()).isGreaterThan(0);

		screenshot("nav-01-dashboard");
	}

	@Test
	@Order(2)
	void should_navigate_all_sidebar_links() {
		assumePriorTestsPassed();
		// given
		navigateTo("/dashboard");
		this.page.locator("h2").first().waitFor();

		String[][] sidebarLinks = { { "Applications", "/applications" }, { "Contracts", "/contracts" },
				{ "Verifications", "/verifications" }, { "Environments", "/environments" },
				{ "Can I Deploy", "/can-i-deploy" }, { "Dependencies", "/graph" }, { "Webhooks", "/webhooks" },
				{ "Matrix", "/matrix" }, { "Tags", "/tags" }, { "Cleanup", "/cleanup" }, { "Settings", "/settings" } };

		for (String[] link : sidebarLinks) {
			String label = link[0];
			String expectedPath = link[1];

			// when
			clickSidebar(label);
			this.page.waitForURL("**" + expectedPath);
			this.page.locator("h2").first().waitFor(new Locator.WaitForOptions().setTimeout(30000));

			// then
			assertThat(this.page.url()).as("Sidebar link '%s' should navigate to %s", label, expectedPath)
				.endsWith(expectedPath);
		}

		screenshot("nav-02-all-pages");
	}

	@Test
	@Order(3)
	void should_toggle_dark_mode() {
		assumePriorTestsPassed();
		// given
		navigateTo("/settings");
		waitForHeading("Settings");

		// when — click dark mode toggle
		Locator darkModeButton = this.page.locator("button:has-text('Dark Mode')");
		if (darkModeButton.count() > 0) {
			darkModeButton.first().click();
			this.page.locator("html.dark").waitFor(new Locator.WaitForOptions().setTimeout(5000));

			// then — html has dark class
			String htmlClass = this.page.locator("html").getAttribute("class");
			assertThat(htmlClass).contains("dark");

			screenshot("nav-03-dark-mode");

			// Toggle back to light
			Locator lightModeButton = this.page.locator("button:has-text('Light Mode')");
			if (lightModeButton.count() > 0) {
				lightModeButton.first().click();
			}
		}
		else {
			// Already in dark mode — toggle to light
			Locator lightModeButton = this.page.locator("button:has-text('Light Mode')");
			lightModeButton.first().click();
			this.page.locator("html:not(.dark)").waitFor(new Locator.WaitForOptions().setTimeout(5000));

			screenshot("nav-03-light-mode");
		}
	}

	@Test
	@Order(4)
	void should_display_settings_info() {
		assumePriorTestsPassed();
		// when
		navigateTo("/settings");
		waitForHeading("Settings");

		// then — API info displayed
		Locator versionText = this.page.locator("text=0.1.0-SNAPSHOT");
		versionText.first().waitFor(new Locator.WaitForOptions().setTimeout(30000));
		assertThat(versionText.count()).isGreaterThan(0);

		Locator springBootText = this.page.locator("text=Spring Boot");
		assertThat(springBootText.count()).isGreaterThan(0);

		screenshot("nav-04-settings");
	}

}
