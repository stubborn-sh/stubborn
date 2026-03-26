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
package sh.stubborn.oss.webhook;

import java.util.UUID;

import io.github.resilience4j.circuitbreaker.CallNotPermittedException;
import io.github.resilience4j.circuitbreaker.CircuitBreaker;
import tools.jackson.databind.json.JsonMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import org.springframework.web.client.RestClient;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class WebhookDispatcherTest {

	@Mock
	WebhookRepository webhookRepository;

	@Mock
	WebhookExecutionRepository executionRepository;

	@Mock
	RestClient.Builder restClientBuilder;

	@Mock
	RestClient restClient;

	WebhookDispatcher dispatcher;

	@BeforeEach
	void setUp() {
		given(this.restClientBuilder.build()).willReturn(this.restClient);
		WebhookEventFilter eventFilter = new OssWebhookEventFilter();
		this.dispatcher = new WebhookDispatcher(this.webhookRepository, this.executionRepository,
				this.restClientBuilder, JsonMapper.builder().build(), eventFilter);
	}

	@Test
	void should_resolve_template_with_application_name() {
		// given
		BrokerEvent event = BrokerEvent.contractPublished(UUID.randomUUID(), "order-service", "1.0.0", "create-order");
		String template = "Contract published for ${applicationName} version ${version}";

		// when
		String resolved = this.dispatcher.resolveTemplate(template, event);

		// then
		assertThat(resolved).isEqualTo("Contract published for order-service version 1.0.0");
	}

	@Test
	void should_resolve_template_with_event_type() {
		// given
		BrokerEvent event = BrokerEvent.deploymentRecorded(UUID.randomUUID(), "order-service", "1.0.0", "production");
		String template = "Event: ${eventType} for ${applicationName} to ${environment}";

		// when
		String resolved = this.dispatcher.resolveTemplate(template, event);

		// then
		assertThat(resolved).isEqualTo("Event: DEPLOYMENT_RECORDED for order-service to production");
	}

	@Test
	void should_resolve_template_with_verification_payload() {
		// given
		BrokerEvent event = BrokerEvent.verificationSucceeded(UUID.randomUUID(), "order-service", "1.0.0",
				"payment-service");
		String template = "Verification of ${applicationName} v${providerVersion} by ${consumerName}";

		// when
		String resolved = this.dispatcher.resolveTemplate(template, event);

		// then
		assertThat(resolved).isEqualTo("Verification of order-service v1.0.0 by payment-service");
	}

	@Test
	void should_record_failure_when_circuit_breaker_open() {
		// given
		UUID webhookId = UUID.randomUUID();
		Webhook webhook = Webhook.create(null, EventType.CONTRACT_PUBLISHED, "https://example.com/hook", null, null);
		BrokerEvent event = BrokerEvent.contractPublished(UUID.randomUUID(), "order-service", "1.0.0", "create-order");
		CircuitBreaker circuitBreaker = CircuitBreaker.ofDefaults("webhookDispatch");
		CallNotPermittedException cbException = CallNotPermittedException
			.createCallNotPermittedException(circuitBreaker);

		// when
		this.dispatcher.deliverFallback(webhook, event, cbException);

		// then
		ArgumentCaptor<WebhookExecution> captor = ArgumentCaptor.forClass(WebhookExecution.class);
		verify(this.executionRepository).save(captor.capture());
		WebhookExecution execution = captor.getValue();
		assertThat(execution.isSuccess()).isFalse();
		assertThat(execution.getErrorMessage()).contains("Circuit breaker");
		assertThat(execution.getRequestUrl()).isEqualTo("https://example.com/hook");
	}

}
