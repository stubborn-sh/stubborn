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

import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.MeterRegistry;

import sh.stubborn.broker.application.ApplicationService;
import sh.stubborn.broker.contract.ContractService;
import sh.stubborn.broker.verification.VerificationService;
import sh.stubborn.broker.tag.TagService;
import sh.stubborn.broker.webhook.WebhookService;
import org.springframework.stereotype.Component;

@Component
class BrokerGauges {

	BrokerGauges(MeterRegistry registry, ApplicationService applicationService, ContractService contractService,
			VerificationService verificationService, WebhookService webhookService, TagService tagService) {
		Gauge.builder("broker.applications.total", applicationService::count)
			.description("Total number of registered applications")
			.register(registry);
		Gauge.builder("broker.contracts.total", contractService::count)
			.description("Total number of published contracts")
			.register(registry);
		Gauge.builder("broker.verifications.total", verificationService::count)
			.description("Total number of verification records")
			.register(registry);
		Gauge.builder("broker.verifications.success.ratio", verificationService::computeSuccessRatio)
			.description("Ratio of successful verifications to total")
			.register(registry);
		Gauge.builder("broker.webhooks.total", webhookService::count)
			.description("Total number of registered webhooks")
			.register(registry);
		Gauge.builder("broker.tags.total", tagService::count)
			.description("Total number of version tags")
			.register(registry);
	}

}
