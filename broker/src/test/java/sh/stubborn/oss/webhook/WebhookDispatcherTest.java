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

import java.time.Duration;
import java.util.UUID;

import com.github.tomakehurst.wiremock.junit5.WireMockExtension;
import io.github.resilience4j.circuitbreaker.CallNotPermittedException;
import io.github.resilience4j.circuitbreaker.CircuitBreaker;
import tools.jackson.databind.json.JsonMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.extension.RegisterExtension;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import org.springframework.http.client.ClientHttpRequestFactory;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;

import org.springframework.mock.env.MockEnvironment;

import sh.stubborn.oss.security.CredentialEncryptionService;

import static com.github.tomakehurst.wiremock.client.WireMock.aResponse;
import static com.github.tomakehurst.wiremock.client.WireMock.post;
import static com.github.tomakehurst.wiremock.client.WireMock.urlEqualTo;
import static com.github.tomakehurst.wiremock.core.WireMockConfiguration.wireMockConfig;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verify;

/**
 * @see <a href="../../../docs/specs/030-webhook-timeout.md">Spec 030 — Webhook
 * Timeout</a>
 */
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

	@Mock
	CredentialEncryptionService encryptionService;

	WebhookDispatcher dispatcher;

	@BeforeEach
	void setUp() {
		given(this.restClientBuilder.requestFactory(any(ClientHttpRequestFactory.class)))
			.willReturn(this.restClientBuilder);
		given(this.restClientBuilder.build()).willReturn(this.restClient);
		// Passthrough encryption for tests (lenient — not all tests trigger encryption)
		org.mockito.Mockito.lenient().when(this.encryptionService.decrypt(any())).thenAnswer(inv -> inv.getArgument(0));
		org.mockito.Mockito.lenient().when(this.encryptionService.encrypt(any())).thenAnswer(inv -> inv.getArgument(0));
		WebhookEventFilter eventFilter = new OssWebhookEventFilter();
		this.dispatcher = new WebhookDispatcher(this.webhookRepository, this.executionRepository,
				this.restClientBuilder, JsonMapper.builder().build(), eventFilter, this.encryptionService);
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

	@Nested
	class TimeoutTests {

		@RegisterExtension
		static WireMockExtension wireMock = WireMockExtension.newInstance()
			.options(wireMockConfig().dynamicPort())
			.build();

		@Mock
		WebhookRepository webhookRepo;

		@Mock
		WebhookExecutionRepository executionRepo;

		@Test
		void should_have_connect_timeout_of_five_seconds() {
			assertThat(WebhookDispatcher.CONNECT_TIMEOUT).isEqualTo(Duration.ofSeconds(5));
		}

		@Test
		void should_have_read_timeout_of_fifteen_seconds() {
			assertThat(WebhookDispatcher.READ_TIMEOUT).isEqualTo(Duration.ofSeconds(15));
		}

		@Test
		void should_timeout_when_server_response_exceeds_read_timeout() {
			// given — WireMock delays 16 seconds, exceeding the 15s read timeout
			wireMock
				.stubFor(post(urlEqualTo("/slow-hook")).willReturn(aResponse().withFixedDelay(16_000).withStatus(200)));
			String url = wireMock.baseUrl() + "/slow-hook";
			Webhook webhook = Webhook.create(null, EventType.CONTRACT_PUBLISHED, url, null, null);
			BrokerEvent event = BrokerEvent.contractPublished(UUID.randomUUID(), "order-service", "1.0.0",
					"create-order");
			WebhookDispatcher realDispatcher = new WebhookDispatcher(this.webhookRepo, this.executionRepo,
					RestClient.builder(), JsonMapper.builder().build(), new OssWebhookEventFilter(),
					new CredentialEncryptionService("", new MockEnvironment()));

			// when
			long start = System.nanoTime();
			realDispatcher.deliverWithRetry(webhook, event);
			Duration elapsed = Duration.ofNanos(System.nanoTime() - start);

			// then — delivery must fail with a timeout error recorded
			ArgumentCaptor<WebhookExecution> captor = ArgumentCaptor.forClass(WebhookExecution.class);
			verify(this.executionRepo).save(captor.capture());
			WebhookExecution execution = captor.getValue();
			assertThat(execution.isSuccess()).isFalse();
			assertThat(execution.getErrorMessage()).satisfiesAnyOf(
					msg -> assertThat(msg).containsIgnoringCase("timed out"),
					msg -> assertThat(msg).containsIgnoringCase("timeout"),
					msg -> assertThat(msg).contains("HttpTimeoutException"),
					msg -> assertThat(msg).containsIgnoringCase("request cancelled"),
					msg -> assertThat(msg).containsIgnoringCase("I/O error"));
			// 2 attempts (initial + 1 retry) × ~15s timeout + 1s backoff ≈ 31s
			assertThat(elapsed).isLessThan(Duration.ofSeconds(60));
		}

		@Test
		void should_succeed_when_server_responds_within_timeout() {
			// given — WireMock responds in 100ms, well within the 15s read timeout
			wireMock.stubFor(post(urlEqualTo("/fast-hook"))
				.willReturn(aResponse().withFixedDelay(100).withStatus(200).withBody("{\"ok\":true}")));
			String url = wireMock.baseUrl() + "/fast-hook";
			Webhook webhook = Webhook.create(null, EventType.CONTRACT_PUBLISHED, url, null, null);
			BrokerEvent event = BrokerEvent.contractPublished(UUID.randomUUID(), "order-service", "1.0.0",
					"create-order");
			WebhookDispatcher realDispatcher = new WebhookDispatcher(this.webhookRepo, this.executionRepo,
					RestClient.builder(), JsonMapper.builder().build(), new OssWebhookEventFilter(),
					new CredentialEncryptionService("", new MockEnvironment()));

			// when
			realDispatcher.deliverWithRetry(webhook, event);

			// then
			ArgumentCaptor<WebhookExecution> captor = ArgumentCaptor.forClass(WebhookExecution.class);
			verify(this.executionRepo).save(captor.capture());
			WebhookExecution execution = captor.getValue();
			assertThat(execution.isSuccess()).isTrue();
		}

	}

}
