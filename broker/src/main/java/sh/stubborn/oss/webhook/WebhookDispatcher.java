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

import java.net.http.HttpClient;
import java.time.Duration;
import java.util.List;
import java.util.Map;

import io.github.resilience4j.circuitbreaker.CallNotPermittedException;
import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import tools.jackson.databind.json.JsonMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import org.springframework.context.event.EventListener;
import org.springframework.http.MediaType;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

@Component
class WebhookDispatcher {

	private static final Logger log = LoggerFactory.getLogger(WebhookDispatcher.class);

	private static final int MAX_RETRIES = 3;

	private static final long[] RETRY_DELAYS_MS = { 1000, 5000, 25000 };

	static final Duration CONNECT_TIMEOUT = Duration.ofSeconds(5);

	static final Duration READ_TIMEOUT = Duration.ofSeconds(15);

	private final WebhookRepository webhookRepository;

	private final WebhookExecutionRepository executionRepository;

	private final RestClient restClient;

	private final JsonMapper jsonMapper;

	private final WebhookEventFilter webhookEventFilter;

	WebhookDispatcher(WebhookRepository webhookRepository, WebhookExecutionRepository executionRepository,
			RestClient.Builder restClientBuilder, JsonMapper jsonMapper, WebhookEventFilter webhookEventFilter) {
		this.webhookRepository = webhookRepository;
		this.executionRepository = executionRepository;
		HttpClient httpClient = HttpClient.newBuilder().connectTimeout(CONNECT_TIMEOUT).build();
		JdkClientHttpRequestFactory requestFactory = new JdkClientHttpRequestFactory(httpClient);
		requestFactory.setReadTimeout(READ_TIMEOUT);
		this.restClient = restClientBuilder.requestFactory(requestFactory).build();
		this.jsonMapper = jsonMapper;
		this.webhookEventFilter = webhookEventFilter;
	}

	@Async
	@EventListener
	void handleBrokerEvent(BrokerEvent event) {
		if (!this.webhookEventFilter.isEventTypeAllowed(event.eventType())) {
			return;
		}
		List<Webhook> webhooks = this.webhookRepository.findMatchingWebhooks(event.eventType(), event.applicationId());
		for (Webhook webhook : webhooks) {
			deliverWithRetry(webhook, event);
		}
	}

	@CircuitBreaker(name = "webhookDispatch", fallbackMethod = "deliverFallback")
	void deliverWithRetry(Webhook webhook, BrokerEvent event) {
		String body = buildBody(webhook, event);
		for (int attempt = 0; attempt <= MAX_RETRIES; attempt++) {
			if (attempt > 0) {
				sleepQuietly(RETRY_DELAYS_MS[attempt - 1]);
			}
			try {
				RestClient.RequestBodySpec request = this.restClient.post()
					.uri(webhook.getUrl())
					.contentType(MediaType.APPLICATION_JSON);
				for (Map.Entry<String, Object> entry : webhook.getHeadersAsMap().entrySet()) {
					request.header(entry.getKey(), String.valueOf(entry.getValue()));
				}
				String responseBody = request.body(body).retrieve().body(String.class);
				this.executionRepository.save(WebhookExecution.success(webhook.getId(), event.eventType(),
						webhook.getUrl(), body, 200, responseBody));
				return;
			}
			catch (Exception ex) {
				log.warn("Webhook delivery failed. webhookId={}, attempt={}/{}, url={}", webhook.getId(), attempt + 1,
						MAX_RETRIES + 1, webhook.getUrl(), ex);
				if (attempt == MAX_RETRIES) {
					String errorMsg = ex.getMessage() != null ? ex.getMessage() : ex.getClass().getName();
					this.executionRepository.save(WebhookExecution.failure(webhook.getId(), event.eventType(),
							webhook.getUrl(), body, null, null, errorMsg));
				}
			}
		}
	}

	@SuppressWarnings("unused")
	void deliverFallback(Webhook webhook, BrokerEvent event, CallNotPermittedException ex) {
		log.warn("Circuit breaker open for webhook dispatch. webhookId={}, url={}", webhook.getId(), webhook.getUrl());
		this.executionRepository.save(WebhookExecution.failure(webhook.getId(), event.eventType(), webhook.getUrl(),
				"(circuit breaker open)", null, null, "Circuit breaker open: " + ex.getMessage()));
	}

	private String buildBody(Webhook webhook, BrokerEvent event) {
		String template = webhook.getBodyTemplate();
		if (template != null) {
			return resolveTemplate(template, event);
		}
		return toJson(event);
	}

	String resolveTemplate(String template, BrokerEvent event) {
		String resolved = template.replace("${applicationName}", event.applicationName())
			.replace("${eventType}", event.eventType().name());
		for (Map.Entry<String, String> entry : event.payload().entrySet()) {
			resolved = resolved.replace("${" + entry.getKey() + "}", entry.getValue());
		}
		return resolved;
	}

	private String toJson(BrokerEvent event) {
		return this.jsonMapper.writeValueAsString(event);
	}

	private void sleepQuietly(long millis) {
		try {
			Thread.sleep(millis);
		}
		catch (InterruptedException ex) {
			Thread.currentThread().interrupt();
		}
	}

}
