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
package org.springframework.cloud.contract.broker.webhook;

import java.util.UUID;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class BrokerEventTest {

	@Test
	void should_create_contract_published_event() {
		// given
		UUID appId = UUID.randomUUID();

		// when
		BrokerEvent event = BrokerEvent.contractPublished(appId, "order-service", "1.0.0", "create-order");

		// then
		assertThat(event.eventType()).isEqualTo(EventType.CONTRACT_PUBLISHED);
		assertThat(event.applicationId()).isEqualTo(appId);
		assertThat(event.applicationName()).isEqualTo("order-service");
		assertThat(event.payload()).containsEntry("version", "1.0.0").containsEntry("contractName", "create-order");
	}

	@Test
	void should_create_verification_succeeded_event() {
		// given
		UUID providerId = UUID.randomUUID();

		// when
		BrokerEvent event = BrokerEvent.verificationSucceeded(providerId, "order-service", "1.0.0", "payment-service");

		// then
		assertThat(event.eventType()).isEqualTo(EventType.VERIFICATION_SUCCEEDED);
		assertThat(event.payload()).containsEntry("providerVersion", "1.0.0")
			.containsEntry("consumerName", "payment-service");
	}

	@Test
	void should_create_verification_failed_event() {
		// given
		UUID providerId = UUID.randomUUID();

		// when
		BrokerEvent event = BrokerEvent.verificationFailed(providerId, "order-service", "1.0.0", "payment-service");

		// then
		assertThat(event.eventType()).isEqualTo(EventType.VERIFICATION_FAILED);
	}

	@Test
	void should_create_verification_published_event() {
		// given
		UUID providerId = UUID.randomUUID();

		// when
		BrokerEvent event = BrokerEvent.verificationPublished(providerId, "order-service", "1.0.0", "payment-service",
				"SUCCESS");

		// then
		assertThat(event.eventType()).isEqualTo(EventType.VERIFICATION_PUBLISHED);
		assertThat(event.payload()).containsEntry("status", "SUCCESS");
	}

	@Test
	void should_create_deployment_recorded_event() {
		// given
		UUID appId = UUID.randomUUID();

		// when
		BrokerEvent event = BrokerEvent.deploymentRecorded(appId, "order-service", "1.0.0", "production");

		// then
		assertThat(event.eventType()).isEqualTo(EventType.DEPLOYMENT_RECORDED);
		assertThat(event.payload()).containsEntry("version", "1.0.0").containsEntry("environment", "production");
	}

}
