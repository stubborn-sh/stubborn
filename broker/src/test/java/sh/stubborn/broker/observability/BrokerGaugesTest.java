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
package sh.stubborn.broker.observability;

import java.util.Objects;

import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import sh.stubborn.broker.application.ApplicationService;
import sh.stubborn.broker.contract.ContractService;
import sh.stubborn.broker.verification.VerificationService;
import sh.stubborn.broker.tag.TagService;
import sh.stubborn.broker.webhook.WebhookService;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.BDDMockito.given;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class BrokerGaugesTest {

	@Mock
	ApplicationService applicationService;

	@Mock
	ContractService contractService;

	@Mock
	VerificationService verificationService;

	@Mock
	WebhookService webhookService;

	@Mock
	TagService tagService;

	SimpleMeterRegistry registry;

	@BeforeEach
	void setUp() {
		this.registry = new SimpleMeterRegistry();
		given(this.applicationService.count()).willReturn(5L);
		given(this.contractService.count()).willReturn(10L);
		given(this.verificationService.count()).willReturn(20L);
		given(this.verificationService.computeSuccessRatio()).willReturn(0.75);
		given(this.webhookService.count()).willReturn(3L);
		given(this.tagService.count()).willReturn(7L);
		new BrokerGauges(this.registry, this.applicationService, this.contractService, this.verificationService,
				this.webhookService, this.tagService);
	}

	@Test
	void should_register_applications_total_gauge() {
		// when
		Gauge gauge = requireGauge("broker.applications.total");

		// then
		assertThat(gauge.value()).isEqualTo(5.0);
	}

	@Test
	void should_register_contracts_total_gauge() {
		// when
		Gauge gauge = requireGauge("broker.contracts.total");

		// then
		assertThat(gauge.value()).isEqualTo(10.0);
	}

	@Test
	void should_register_verifications_total_gauge() {
		// when
		Gauge gauge = requireGauge("broker.verifications.total");

		// then
		assertThat(gauge.value()).isEqualTo(20.0);
	}

	@Test
	void should_register_success_ratio_gauge() {
		// when
		Gauge gauge = requireGauge("broker.verifications.success.ratio");

		// then
		assertThat(gauge.value()).isEqualTo(0.75);
	}

	@Test
	void should_register_webhooks_total_gauge() {
		// when
		Gauge gauge = requireGauge("broker.webhooks.total");

		// then
		assertThat(gauge.value()).isEqualTo(3.0);
	}

	@Test
	void should_register_tags_total_gauge() {
		// when
		Gauge gauge = requireGauge("broker.tags.total");

		// then
		assertThat(gauge.value()).isEqualTo(7.0);
	}

	@Test
	void should_have_descriptions_on_all_gauges() {
		// then
		assertThat(requireGauge("broker.applications.total").getId().getDescription())
			.isEqualTo("Total number of registered applications");
		assertThat(requireGauge("broker.contracts.total").getId().getDescription())
			.isEqualTo("Total number of published contracts");
		assertThat(requireGauge("broker.verifications.total").getId().getDescription())
			.isEqualTo("Total number of verification records");
		assertThat(requireGauge("broker.verifications.success.ratio").getId().getDescription())
			.isEqualTo("Ratio of successful verifications to total");
		assertThat(requireGauge("broker.webhooks.total").getId().getDescription())
			.isEqualTo("Total number of registered webhooks");
		assertThat(requireGauge("broker.tags.total").getId().getDescription())
			.isEqualTo("Total number of version tags");
	}

	private Gauge requireGauge(String name) {
		return Objects.requireNonNull(this.registry.find(name).gauge(), "Gauge '" + name + "' not found");
	}

}
